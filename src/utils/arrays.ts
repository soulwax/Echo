export const chunk = <T>(arr: T[], len: number): T[][] => {
  const chunks: T[][] = []; // Explicitly typing the chunks array

  let i = 0;
  while (i < arr.length) {
    chunks.push(arr.slice(i, (i += len)));
  }

  return chunks;
}