export function logEvent(type: string, data: any) {
  console.log(`[${type}]`, JSON.stringify(data));
}