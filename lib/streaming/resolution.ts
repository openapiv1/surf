import { Sandbox } from "@e2b/desktop";
import {
  MAX_RESOLUTION_WIDTH,
  MAX_RESOLUTION_HEIGHT,
  MIN_RESOLUTION_WIDTH,
  MIN_RESOLUTION_HEIGHT,
} from "@/lib/config";
import { logDebug } from "@/lib/logger";
import sharp from "sharp";

/**
 * ResolutionScaler handles all aspects of resolution scaling between the original desktop
 * resolution and the scaled model resolution, including coordinate transformations and
 * screenshot scaling.
 */
export class ResolutionScaler {
  // Private properties
  private desktop: Sandbox;
  private originalResolution: [number, number];
  private scaledResolution: [number, number];
  private scaleFactor: number;
  private originalAspectRatio: number;
  private scaledAspectRatio: number;

  /**
   * Creates a new ResolutionScaler
   *
   * @param desktop - The sandbox instance used for taking screenshots
   * @param originalResolution - The original desktop resolution
   */
  constructor(desktop: Sandbox, originalResolution: [number, number]) {
    this.desktop = desktop;
    this.originalResolution = originalResolution;
    this.originalAspectRatio = originalResolution[0] / originalResolution[1];

    // Calculate scaled resolution and scale factor immediately on instantiation
    const { scaledResolution, scaleFactor } =
      this.calculateScaledResolution(originalResolution);
    this.scaledResolution = scaledResolution;
    this.scaleFactor = scaleFactor;
    this.scaledAspectRatio = scaledResolution[0] / scaledResolution[1];

    // Validate aspect ratio preservation
    const aspectRatioDifference = Math.abs(
      this.originalAspectRatio - this.scaledAspectRatio
    );
    const aspectRatioPercentage =
      (aspectRatioDifference / this.originalAspectRatio) * 100;

    logDebug(
      `[ResolutionScaler] Initialized with:
        Original resolution: [${originalResolution[0]}, ${
        originalResolution[1]
      }]
        Original aspect ratio: ${this.originalAspectRatio.toFixed(6)}
        Scaled resolution: [${scaledResolution[0]}, ${scaledResolution[1]}]
        Scaled aspect ratio: ${this.scaledAspectRatio.toFixed(6)}
        Aspect ratio difference: ${aspectRatioDifference.toFixed(
          6
        )} (${aspectRatioPercentage.toFixed(4)}%)
        Scale factor: ${scaleFactor}`
    );

    // Warn if aspect ratio difference is significant
    if (aspectRatioPercentage > 0.1) {
      logDebug(
        `[ResolutionScaler] WARNING: Aspect ratio difference exceeds 0.1% threshold.
         This may cause distortion in the scaled view and affect coordinate precision.`
      );
    }

    // Validate round-trip coordinate accuracy
    this.validateCoordinateScaling();
  }

  /**
   * Get the original desktop resolution
   */
  public getOriginalResolution(): [number, number] {
    return this.originalResolution;
  }

  /**
   * Get the scaled resolution used for model interactions
   */
  public getScaledResolution(): [number, number] {
    return this.scaledResolution;
  }

  /**
   * Get the scale factor between original and scaled resolutions
   */
  public getScaleFactor(): number {
    return this.scaleFactor;
  }

  /**
   * Get the aspect ratio of the original resolution
   */
  public getOriginalAspectRatio(): number {
    return this.originalAspectRatio;
  }

  /**
   * Get the aspect ratio of the scaled resolution
   */
  public getScaledAspectRatio(): number {
    return this.scaledAspectRatio;
  }

  /**
   * Validate that coordinate scaling functions work properly across different parts of the screen
   * by performing round-trip tests on several key positions
   */
  private validateCoordinateScaling(): void {
    logDebug(`[ResolutionScaler] Validating coordinate scaling accuracy...`);

    // Test points at corners, center, and edges
    const testPoints: Array<{ name: string; point: [number, number] }> = [
      { name: "Top-left corner", point: [0, 0] },
      { name: "Top-right corner", point: [this.originalResolution[0] - 1, 0] },
      {
        name: "Bottom-left corner",
        point: [0, this.originalResolution[1] - 1],
      },
      {
        name: "Bottom-right corner",
        point: [this.originalResolution[0] - 1, this.originalResolution[1] - 1],
      },
      {
        name: "Center",
        point: [
          Math.floor(this.originalResolution[0] / 2),
          Math.floor(this.originalResolution[1] / 2),
        ],
      },
      { name: "Small target (10px)", point: [10, 10] }, // Small target test
    ];

    let maxError = 0;
    let errorSum = 0;
    let worstPoint = "";

    for (const { name, point } of testPoints) {
      const roundTripTest = this.testCoordinateRoundTrip(point);

      // Calculate error magnitude (Euclidean distance)
      const errorMagnitude = Math.sqrt(
        Math.pow(roundTripTest.error[0], 2) +
          Math.pow(roundTripTest.error[1], 2)
      );

      errorSum += errorMagnitude;

      if (errorMagnitude > maxError) {
        maxError = errorMagnitude;
        worstPoint = name;
      }

      // Verify that aspect ratio is maintained in target space
      const originalPointRatio = point[0] !== 0 ? point[1] / point[0] : 0;
      const modelPointRatio =
        roundTripTest.modelSpace[0] !== 0
          ? roundTripTest.modelSpace[1] / roundTripTest.modelSpace[0]
          : 0;

      // Only log ratios if both point coordinates are non-zero
      if (point[0] !== 0 && point[1] !== 0) {
        const ratioError = Math.abs(originalPointRatio - modelPointRatio);
        logDebug(
          `[ResolutionScaler] Point ratio test for ${name}:
           Original point ratio (y/x): ${originalPointRatio.toFixed(6)}
           Model space point ratio (y/x): ${modelPointRatio.toFixed(6)}
           Ratio difference: ${ratioError.toFixed(6)}`
        );
      }

      logDebug(
        `[ResolutionScaler] Coordinate test for ${name}:
         Original: [${point[0]}, ${point[1]}]
         Model space: [${roundTripTest.modelSpace[0]}, ${
          roundTripTest.modelSpace[1]
        }]
         Round-trip: [${roundTripTest.roundTrip[0]}, ${
          roundTripTest.roundTrip[1]
        }]
         Error: [${roundTripTest.error[0]}, ${roundTripTest.error[1]}]
         Error magnitude: ${errorMagnitude.toFixed(4)}`
      );
    }

    const averageError = errorSum / testPoints.length;

    logDebug(
      `[ResolutionScaler] Coordinate scaling validation summary:
       Average error: ${averageError.toFixed(4)} pixels
       Maximum error: ${maxError.toFixed(4)} pixels at ${worstPoint}
       Scale factor: ${this.scaleFactor}`
    );

    if (maxError > 1) {
      logDebug(
        `[ResolutionScaler] WARNING: Maximum coordinate error exceeds 1 pixel.
         This may cause precision issues for small UI elements.`
      );
    }
  }

  /**
   * Convert coordinates from model space to original desktop space
   * This is used when the model sends coordinates (based on scaled screenshot)
   * that need to be converted to the original desktop space for actual interaction.
   *
   * @param coordinate - Coordinates in model's scaled space
   * @returns Coordinates in original desktop space
   */
  public scaleToOriginalSpace(coordinate: [number, number]): [number, number] {
    // Store the exact scaled values before rounding
    const exactScaledX = coordinate[0] / this.scaleFactor;
    const exactScaledY = coordinate[1] / this.scaleFactor;

    // Round only at the final step for pixel-perfect positioning
    const finalX = Math.round(exactScaledX);
    const finalY = Math.round(exactScaledY);

    // Check for small targets where rounding may cause significant position shifts
    if (
      Math.abs(finalX - exactScaledX) > 0.1 ||
      Math.abs(finalY - exactScaledY) > 0.1
    ) {
      logDebug(
        `[ResolutionScaler] PRECISION WARNING: Significant rounding when scaling to original space:
         Exact: [${exactScaledX.toFixed(3)}, ${exactScaledY.toFixed(3)}]
         Rounded: [${finalX}, ${finalY}]
         Difference: [${(finalX - exactScaledX).toFixed(3)}, ${(
          finalY - exactScaledY
        ).toFixed(3)}]
         Point aspect ratio before: ${(coordinate[1] / coordinate[0]).toFixed(
           6
         )}
         Point aspect ratio after: ${(finalY / finalX).toFixed(6)}`
      );
    }

    logDebug(
      `[ResolutionScaler] scaleToOriginalSpace: [${coordinate[0]}, ${
        coordinate[1]
      }] → [${finalX}, ${finalY}]
       (exact: [${exactScaledX.toFixed(3)}, ${exactScaledY.toFixed(3)}])`
    );

    return [finalX, finalY];
  }

  /**
   * Convert coordinates from original desktop space to model space
   * This is used when desktop coordinates need to be represented in the model's scaled space.
   *
   * @param coordinate - Coordinates in original desktop space
   * @returns Coordinates in model's scaled space
   */
  public scaleToModelSpace(coordinate: [number, number]): [number, number] {
    // Store the exact scaled values before rounding
    const exactScaledX = coordinate[0] * this.scaleFactor;
    const exactScaledY = coordinate[1] * this.scaleFactor;

    // Round only at the final step for pixel-perfect representation
    const finalX = Math.round(exactScaledX);
    const finalY = Math.round(exactScaledY);

    // Check for small targets where rounding may cause significant position shifts
    if (
      Math.abs(finalX - exactScaledX) > 0.1 ||
      Math.abs(finalY - exactScaledY) > 0.1
    ) {
      logDebug(
        `[ResolutionScaler] PRECISION WARNING: Significant rounding when scaling to model space:
         Exact: [${exactScaledX.toFixed(3)}, ${exactScaledY.toFixed(3)}]
         Rounded: [${finalX}, ${finalY}]
         Difference: [${(finalX - exactScaledX).toFixed(3)}, ${(
          finalY - exactScaledY
        ).toFixed(3)}]
         Point aspect ratio before: ${(coordinate[1] / coordinate[0]).toFixed(
           6
         )}
         Point aspect ratio after: ${(finalY / finalX).toFixed(6)}`
      );
    }

    logDebug(
      `[ResolutionScaler] scaleToModelSpace: [${coordinate[0]}, ${
        coordinate[1]
      }] → [${finalX}, ${finalY}]
       (exact: [${exactScaledX.toFixed(3)}, ${exactScaledY.toFixed(3)}])`
    );

    return [finalX, finalY];
  }

  /**
   * Test the round-trip accuracy of coordinate scaling
   * This helps identify potential precision issues with small targets
   *
   * @param originalCoordinate - A coordinate in original space to test
   * @returns Object containing the original, model space, and round-trip coordinates
   */
  public testCoordinateRoundTrip(originalCoordinate: [number, number]): {
    original: [number, number];
    modelSpace: [number, number];
    roundTrip: [number, number];
    error: [number, number];
  } {
    const modelSpace = this.scaleToModelSpace(originalCoordinate);
    const roundTrip = this.scaleToOriginalSpace(modelSpace);

    const error: [number, number] = [
      roundTrip[0] - originalCoordinate[0],
      roundTrip[1] - originalCoordinate[1],
    ];

    logDebug(
      `[ResolutionScaler] Round-trip test:
       Original: [${originalCoordinate[0]}, ${originalCoordinate[1]}]
       Model space: [${modelSpace[0]}, ${modelSpace[1]}]
       Round-trip: [${roundTrip[0]}, ${roundTrip[1]}]
       Error: [${error[0]}, ${error[1]}]`
    );

    return { original: originalCoordinate, modelSpace, roundTrip, error };
  }

  /**
   * Take a screenshot at the scaled resolution suitable for model consumption
   *
   * @returns A buffer containing the scaled screenshot
   */
  public async takeScreenshot(): Promise<Buffer> {
    logDebug(`[ResolutionScaler] Taking scaled screenshot`);

    // Take the original screenshot
    const originalScreenshot = await this.desktop.screenshot();
    logDebug(
      `[ResolutionScaler] Original screenshot taken, size: ${originalScreenshot.byteLength} bytes`
    );

    // If no scaling is needed, return the original
    if (this.scaleFactor === 1) {
      logDebug(
        `[ResolutionScaler] No scaling needed (factor=1), returning original screenshot`
      );
      return Buffer.from(originalScreenshot);
    }

    // Scale the screenshot - use high quality settings for better small target visibility
    logDebug(
      `[ResolutionScaler] Scaling screenshot to: [${
        this.scaledResolution[0]
      }, ${this.scaledResolution[1]}]
       Original aspect ratio: ${this.originalAspectRatio.toFixed(6)}
       Target aspect ratio: ${this.scaledAspectRatio.toFixed(6)}`
    );

    const scaledScreenshot = await this.scaleScreenshot(
      originalScreenshot,
      this.scaledResolution
    );

    logDebug(
      `[ResolutionScaler] Scaled screenshot size: ${
        scaledScreenshot.byteLength
      } bytes (${Math.round(
        (scaledScreenshot.byteLength / originalScreenshot.byteLength) * 100
      )}% of original)`
    );

    return scaledScreenshot;
  }

  /**
   * Calculate a scaled resolution that maintains aspect ratio and fits within boundaries
   *
   * @param originalResolution - The original resolution to scale
   * @returns The scaled resolution and scale factor
   */
  private calculateScaledResolution(originalResolution: [number, number]): {
    scaledResolution: [number, number];
    scaleFactor: number;
  } {
    const [width, height] = originalResolution;
    const originalAspectRatio = width / height;

    logDebug(
      `[ResolutionScaler] calculateScaledResolution: Original resolution: [${width}, ${height}]
       Original aspect ratio: ${originalAspectRatio.toFixed(6)}`
    );

    logDebug(
      `[ResolutionScaler] Boundaries: MIN [${MIN_RESOLUTION_WIDTH}, ${MIN_RESOLUTION_HEIGHT}], MAX [${MAX_RESOLUTION_WIDTH}, ${MAX_RESOLUTION_HEIGHT}]`
    );

    // If resolution is already within bounds, return it as is
    if (
      width <= MAX_RESOLUTION_WIDTH &&
      width >= MIN_RESOLUTION_WIDTH &&
      height <= MAX_RESOLUTION_HEIGHT &&
      height >= MIN_RESOLUTION_HEIGHT
    ) {
      logDebug(
        `[ResolutionScaler] Resolution already within bounds, keeping original: [${width}, ${height}]`
      );
      return {
        scaledResolution: [width, height],
        scaleFactor: 1,
      };
    }

    // Calculate scale factors for width and height
    let widthScaleFactor = 1;
    if (width > MAX_RESOLUTION_WIDTH) {
      widthScaleFactor = MAX_RESOLUTION_WIDTH / width;
    } else if (width < MIN_RESOLUTION_WIDTH) {
      widthScaleFactor = MIN_RESOLUTION_WIDTH / width;
    }

    let heightScaleFactor = 1;
    if (height > MAX_RESOLUTION_HEIGHT) {
      heightScaleFactor = MAX_RESOLUTION_HEIGHT / height;
    } else if (height < MIN_RESOLUTION_HEIGHT) {
      heightScaleFactor = MIN_RESOLUTION_HEIGHT / height;
    }

    logDebug(
      `[ResolutionScaler] Width scale factor: ${widthScaleFactor.toFixed(
        6
      )}, Height scale factor: ${heightScaleFactor.toFixed(6)}`
    );

    // Use the appropriate scale factor to ensure both dimensions are within bounds
    let scaleFactor;
    if (widthScaleFactor < 1 || heightScaleFactor < 1) {
      // We need to scale down, use the smaller factor
      scaleFactor = Math.min(widthScaleFactor, heightScaleFactor);
    } else {
      // We need to scale up, use the larger factor
      scaleFactor = Math.max(widthScaleFactor, heightScaleFactor);
    }

    // Calculate new dimensions - store exact values before rounding
    const exactScaledWidth = width * scaleFactor;
    const exactScaledHeight = height * scaleFactor;
    const exactScaledAspectRatio = exactScaledWidth / exactScaledHeight;

    logDebug(
      `[ResolutionScaler] Exact scaled dimensions: [${exactScaledWidth.toFixed(
        6
      )}, ${exactScaledHeight.toFixed(6)}]
       Exact scaled aspect ratio: ${exactScaledAspectRatio.toFixed(6)}
       Aspect ratio difference from original: ${Math.abs(
         originalAspectRatio - exactScaledAspectRatio
       ).toFixed(6)}`
    );

    // Round to integer pixels at the final step
    const scaledWidth = Math.round(exactScaledWidth);
    const scaledHeight = Math.round(exactScaledHeight);
    const scaledAspectRatio = scaledWidth / scaledHeight;

    // Recalculate the final scale factor based on the rounded dimensions
    // This ensures more accurate coordinate scaling when using these dimensions
    const finalWidthScaleFactor = scaledWidth / width;
    const finalHeightScaleFactor = scaledHeight / height;

    // Using geometric mean for scale factor to better preserve aspect ratio
    const finalScaleFactor = Math.sqrt(
      finalWidthScaleFactor * finalHeightScaleFactor
    );

    // Calculate aspect ratio differences to validate consistency
    const exactToRoundedDifference = Math.abs(
      exactScaledAspectRatio - scaledAspectRatio
    );
    const originalToScaledDifference = Math.abs(
      originalAspectRatio - scaledAspectRatio
    );
    const percentageDifference =
      (originalToScaledDifference / originalAspectRatio) * 100;

    logDebug(
      `[ResolutionScaler] Resolution scaling details:
       Initial scale factor: ${scaleFactor.toFixed(6)}
       Exact scaled dimensions: [${exactScaledWidth.toFixed(
         2
       )}, ${exactScaledHeight.toFixed(2)}]
       Rounded dimensions: [${scaledWidth}, ${scaledHeight}]
       Rounded aspect ratio: ${scaledAspectRatio.toFixed(6)}
       Aspect ratio difference due to rounding: ${exactToRoundedDifference.toFixed(
         6
       )}
       Aspect ratio difference from original: ${originalToScaledDifference.toFixed(
         6
       )} (${percentageDifference.toFixed(4)}%)
       Final scale factor: ${finalScaleFactor.toFixed(
         6
       )} (width: ${finalWidthScaleFactor.toFixed(
        6
      )}, height: ${finalHeightScaleFactor.toFixed(6)})`
    );

    // Warn if there's a significant aspect ratio difference after rounding
    if (percentageDifference > 0.1) {
      logDebug(
        `[ResolutionScaler] WARNING: Aspect ratio deviation after rounding exceeds 0.1%.
         This may cause slight distortion in scaling and coordinate transformation.`
      );
    }

    return {
      scaledResolution: [scaledWidth, scaledHeight],
      scaleFactor: finalScaleFactor,
    };
  }

  /**
   * Scale a screenshot to the specified resolution
   *
   * @param screenshot - The original screenshot buffer
   * @param targetResolution - The target resolution to scale to
   * @returns A buffer containing the scaled screenshot
   */
  private async scaleScreenshot(
    screenshot: Buffer | Uint8Array,
    targetResolution: [number, number]
  ): Promise<Buffer> {
    const [width, height] = targetResolution;
    const targetAspectRatio = width / height;

    logDebug(
      `[ResolutionScaler] scaleScreenshot: Scaling to target resolution: [${width}, ${height}]
       Target aspect ratio: ${targetAspectRatio.toFixed(6)}
       Original aspect ratio: ${this.originalAspectRatio.toFixed(6)}
       Difference: ${Math.abs(
         targetAspectRatio - this.originalAspectRatio
       ).toFixed(6)}`
    );

    try {
      // Use higher quality settings to preserve small UI elements better
      const result = await sharp(screenshot)
        .resize(width, height, {
          fit: "fill",
          kernel: "lanczos3", // Higher quality resampling kernel (default is lanczos3)
          fastShrinkOnLoad: false, // Disable fast shrink for higher quality
        })
        .toBuffer();

      // Analyze the dimensions of the resulting image to verify aspect ratio
      const metadata = await sharp(result).metadata();

      if (metadata.width && metadata.height) {
        const resultAspectRatio = metadata.width / metadata.height;
        const aspectRatioDifference = Math.abs(
          resultAspectRatio - targetAspectRatio
        );
        const percentageDifference =
          (aspectRatioDifference / targetAspectRatio) * 100;

        logDebug(
          `[ResolutionScaler] Screenshot scaling validation:
           Requested dimensions: [${width}, ${height}], aspect ratio: ${targetAspectRatio.toFixed(
            6
          )}
           Actual dimensions: [${metadata.width}, ${
            metadata.height
          }], aspect ratio: ${resultAspectRatio.toFixed(6)}
           Difference: ${aspectRatioDifference.toFixed(
             6
           )} (${percentageDifference.toFixed(4)}%)`
        );

        if (percentageDifference > 0.1) {
          logDebug(
            `[ResolutionScaler] WARNING: Scaled image aspect ratio deviates by more than 0.1% from target.
             This may affect coordinate precision.`
          );
        }
      }

      logDebug(
        `[ResolutionScaler] Screenshot successfully scaled to [${width}, ${height}]`
      );
      return result;
    } catch (error) {
      logDebug("[ResolutionScaler] Error scaling screenshot:", error);
      // Return original if scaling fails, ensuring it's a Buffer
      return Buffer.from(screenshot);
    }
  }
}
