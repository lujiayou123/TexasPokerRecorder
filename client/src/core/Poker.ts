export interface IPoker {
  init(): void;

  getCard(): string;

  getRandom(num: number): number;
}

/**
 * Created by jorky on 2020/2/23.
 */
export class Poker implements IPoker {
  private pokers: string [] = [];
  private readonly isShort: boolean;

  constructor(isShort = false) {
    this.isShort = isShort;
    this.init();
  }

  public init(): void {
    let size = [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm' ];
    if (this.isShort) {
      size = [
        'e',
        'f',
        'g',
        'h',
        'i',
        'j',
        'k',
        'l',
        'm' ];
    }
    const color = [ 1, 2, 3, 4 ];
    for (const i of size) {
      for (const j of color) {
        this.pokers.push(`${i}${j}`);
      }
    }
  }

  public getCard(): string {
    if (this.pokers.length === 0) { return 'done'; }
    const currCardIndex = this.getRandom(this.pokers.length);
    const currCard = this.pokers[currCardIndex];
    this.pokers.splice(currCardIndex, 1);
    return currCard;
  }

  public getRandom(num: number): number {
    const maxNumber = Math.ceil(num);
    return Math.floor(Math.random() * maxNumber);
  }
}
