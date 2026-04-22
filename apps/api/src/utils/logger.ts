export function logEvent(type: string, data: unknown) {
  console.log(`[${type}]`, JSON.stringify(data));
}
