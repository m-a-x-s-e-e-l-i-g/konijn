declare module 'howler' {
  export class Howl {
    constructor(options: any)
    play(id?: string | number): number
    rate(val?: number, id?: number): number
  }
}
