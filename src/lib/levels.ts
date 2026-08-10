// Oneindige levels: geef een reeks basisdrempels; daarna groeien ze door.
export function niveau(waarde: number, basis: number[], groei = 1.6) {
  const arr = [...basis]
  while (arr[arr.length - 1] <= waarde) {
    const volgend = Math.round((arr[arr.length - 1] * groei) / 5) * 5
    arr.push(volgend > arr[arr.length - 1] ? volgend : arr[arr.length - 1] + 5)
  }
  let level = 1
  let start = 0
  for (let i = 0; i < arr.length; i++) {
    if (waarde >= arr[i]) { level = i + 2; start = arr[i] }
    else return { level, volgende: arr[i], start }
  }
  return { level, volgende: arr[arr.length - 1], start }
}

// Gedeelde basis voor de "Kermisganger"-track (aantal check-ins).
export const KERMISGANGER = [1, 3, 6, 10, 20]
