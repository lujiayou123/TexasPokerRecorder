'use strict';

const rankCodes: { [key: string]: number; } = {
    2: 0
  , 3: 1
  , 4: 2
  , 5: 3
  , 6: 4
  , 7: 5
  , 8: 6
  , 9: 7
  , T: 8
  , J: 9
  , Q: 10
  , K: 11
  , A: 12,
};

const codeRanks: { [key: number]: string; } = {
    0  : '2'
  , 1  : '3'
  , 2  : '4'
  , 3  : '5'
  , 4  : '6'
  , 5  : '7'
  , 6  : '8'
  , 7  : '9'
  , 8  : 'T'
  , 9  : 'J'
  , 10 : 'Q'
  , 11 : 'K'
  , 12 : 'A',
};

function byCodeRankDescending(a: number, b: number) {
  const codea1 = rankCodes[a];
  const codeb1 = rankCodes[b];
  if (codea1 < codeb1) {
    return 1;
  }
  if (codeb1 < codea1) {
    return -1;
  }
  const codea2 = rankCodes[a];
  const codeb2 = rankCodes[b];
  return codea2 < codeb2 ? 1 : -1;
}

module.exports = { rankCodes, codeRanks, byCodeRankDescending };
