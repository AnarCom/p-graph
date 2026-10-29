export const wildcardInputDataType = 'any';

export function arePortTypesCompatible(
  sourceDataType: string,
  targetDataType: string,
): boolean {
  return (
    targetDataType === wildcardInputDataType ||
    sourceDataType === targetDataType
  );
}
