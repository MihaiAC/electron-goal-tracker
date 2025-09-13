/**
 * Pattern definitions for progress bars based on Hero Patterns
 * Each pattern is stored as a base64-encoded SVG that can be used as a background image
 */

export interface PatternDefinition {
  id: string;
  name: string;
  svgUrl: string; // SVG pattern as a data URL
  description: string;
}

/**
 * Generates a pattern URL with custom color
 * @param svgContent Original SVG content with #000000 as the fill color
 * @param color Hex color to use for the pattern
 * @returns URL-encoded SVG for use in CSS background-image
 */
function createPatternUrl(
  svgContent: string,
  color: string = "#000000"
): string {
  // The SVG content is already URL-encoded, so we need to decode it first
  const decodedSvg = decodeURIComponent(svgContent);

  // Replace the default black color with the provided color
  const processedSvg = decodedSvg
    .replace(/fill="#000000"/g, `fill="${color}"`)
    .replace(/stroke="#000000"/g, `stroke="${color}"`);

  return `url("data:image/svg+xml,${encodeURIComponent(processedSvg)}")`;
}

/**
 * Gets a pattern URL with the specified color
 * @param patternId ID of the pattern to use
 * @param color Hex color to use for the pattern (defaults to black)
 * @returns URL for the pattern with the specified color
 */
export function getPatternUrl(
  patternId: string | undefined,
  color: string = "#000000"
): string {
  if (!patternId) return "";

  const pattern = patterns.find((p) => p.id === patternId);
  if (!pattern) return "";

  // Extract the SVG content from the data URL
  const svgContent = pattern.svgUrl.replace("data:image/svg+xml,", "");
  const result = createPatternUrl(svgContent, color);

  return result;
}

/**
 * Collection of patterns available for progress bars
 * Each pattern is defined with an ID, name, SVG content, and description
 *
 * To add a new pattern:
 * 1. Create the SVG with #000000 as the fill/stroke color
 * 2. URL-encode the SVG
 * 3. Add a new entry to this array
 */
export const patterns: PatternDefinition[] = [
  {
    id: "diagonal-lines",
    name: "Diagonal Lines",
    svgUrl:
      'data:image/svg+xml,%3Csvg width="6" height="6" viewBox="0 0 6 6" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23000000" fill-opacity="1" fill-rule="evenodd"%3E%3Cpath d="M5 0h1L0 6V5zM6 5v1H5z"/%3E%3C/g%3E%3C/svg%3E',
    description: "Simple diagonal lines pattern",
  },
  {
    id: "tiny-checkers",
    name: "Tiny Checkers",
    svgUrl:
      'data:image/svg+xml,%3Csvg width="8" height="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath fill="%23000000" fill-opacity="1" d="M0 0h4v4H0V0zm4 4h4v4H4V4z" fill-rule="evenodd"/%3E%3C/svg%3E',
    description: "Small checkered pattern",
  },
  {
    id: "endless-clouds",
    name: "Endless Clouds",
    svgUrl:
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 28" width="56" height="28"%3E%3Cpath fill="%23000000" fill-opacity="1" d="M56 26v2h-7.75c2.3-1.27 4.94-2 7.75-2zm-26 2a2 2 0 1 0-4 0h-4.09A25.98 25.98 0 0 0 0 16v-2c.67 0 1.34.02 2 .07V14a2 2 0 0 0-2-2v-2a4 4 0 0 1 3.98 3.6 28.09 28.09 0 0 1 2.8-3.86A8 8 0 0 0 0 6V4a9.99 9.99 0 0 1 8.17 4.23c.94-.95 1.96-1.83 3.03-2.63A13.98 13.98 0 0 0 0 0h7.75c2 1.1 3.73 2.63 5.1 4.45 1.12-.72 2.3-1.37 3.53-1.93A20.1 20.1 0 0 0 14.28 0h2.7c.45.56.88 1.14 1.29 1.74 1.3-.48 2.63-.87 4-1.15-.11-.2-.23-.4-.36-.59H26v.07a28.4 28.4 0 0 1 4 0V0h4.09l-.37.59c1.38.28 2.72.67 4.01 1.15.4-.6.84-1.18 1.3-1.74h2.69a20.1 20.1 0 0 0-2.1 2.52c1.23.56 2.41 1.2 3.54 1.93A16.08 16.08 0 0 1 48.25 0H56c-4.58 0-8.65 2.2-11.2 5.6 1.07.8 2.09 1.68 3.03 2.63A9.99 9.99 0 0 1 56 4v2a8 8 0 0 0-6.77 3.74c1.03 1.2 1.97 2.5 2.79 3.86A4 4 0 0 1 56 10v2a2 2 0 0 0-2 2.07 28.4 28.4 0 0 1 2-.07v2c-9.2 0-17.3 4.78-21.91 12H30zM7.75 28H0v-2c2.81 0 5.46.73 7.75 2zM56 20v2c-5.6 0-10.65 2.3-14.28 6h-2.7c4.04-4.89 10.15-8 16.98-8zm-39.03 8h-2.69C10.65 24.3 5.6 22 0 22v-2c6.83 0 12.94 3.11 16.97 8zm15.01-.4a28.09 28.09 0 0 1 2.8-3.86 8 8 0 0 0-13.55 0c1.03 1.2 1.97 2.5 2.79 3.86a4 4 0 0 1 7.96 0zm14.29-11.86c1.3-.48 2.63-.87 4-1.15a25.99 25.99 0 0 0-44.55 0c1.38.28 2.72.67 4.01 1.15a21.98 21.98 0 0 1 36.54 0zm-5.43 2.71c1.13-.72 2.3-1.37 3.54-1.93a19.98 19.98 0 0 0-32.76 0c1.23.56 2.41 1.2 3.54 1.93a15.98 15.98 0 0 1 25.68 0zm-4.67 3.78c.94-.95 1.96-1.83 3.03-2.63a13.98 13.98 0 0 0-22.4 0c1.07.8 2.09 1.68 3.03 2.63a9.99 9.99 0 0 1 16.34 0z"%3E%3C/path%3E%3C/svg%3E',
    description: "Cloud pattern with endless repetition",
  },
  {
    id: "cutout",
    name: "Cutout",
    svgUrl:
      'data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23000000" fill-opacity="1" fill-rule="evenodd"%3E%3Cpath d="M20 20c0 11.046-8.954 20-20 20v-40c11.046 0 20 8.954 20 20zM0 20v20c11.046 0 20-8.954 20-20S11.046 0 0 0v20z"/%3E%3C/g%3E%3C/svg%3E',
    description: "Circular cutout pattern",
  },
  {
    id: "parkay-floor",
    name: "Parkay Floor",
    svgUrl:
      'data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23000000" fill-opacity="1" fill-rule="evenodd"%3E%3Cpath d="M0 40l40-40H20L0 20M40 40V20l-20 20"/%3E%3C/g%3E%3C/svg%3E',
    description: "Parquet floor pattern",
  },
  {
    id: "polka-dots",
    name: "Polka Dots",
    svgUrl:
      'data:image/svg+xml,%3Csvg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23000000" fill-opacity="1"%3E%3Ccircle cx="3" cy="3" r="3"/%3E%3Ccircle cx="13" cy="13" r="3"/%3E%3C/g%3E%3C/svg%3E',
    description: "Classic polka dot pattern",
  },
];

/**
 * Default color for patterns
 */
export const DEFAULT_PATTERN_COLOR = "#000000";
