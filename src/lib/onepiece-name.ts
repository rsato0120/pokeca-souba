export function onePieceShortName(name: string): string {
  return name.split('[')[0].replace(/\s+:[^\[]*$/, '').trim()
}
