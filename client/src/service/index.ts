import request from '../utils/request';
import myRequest from '@/utils/myRequest';
import myGetRequest from '@/utils/myGetRequest';

export default {
  register: ({ userAccount = '', password = '', nickName = '' }) => request({
    url: '/user/register',
    body: { userAccount, password, nickName },
  }),
  login: (userAccount: string, password: string ) => request({
    url: '/user/login',
    body: { userAccount, password },
  }),
  checkLogin: () => request({
    url: '/user',
    body: {},
  }),
  createRoom: (isShort: boolean, smallBlind: number, time: number) => request({
    url: '/game/room',
    body: { isShort, smallBlind, time },
  }),
  findRoom: (roomNumber: string) => request({
    url: '/game/room/find',
    body: { roomNumber },
  }),
  buyIn: (buyInSize: number) => request({
    url: '/game/buyIn',
    body: { buyInSize },
  }),
  commandRecordList: (roomNumber: string, gameId: number) => request({
    url: '/game/record/find/commandRecord',
    body: { roomNumber, gameId },
  }),
  gameRecordList: (roomNumber: string) => request({
    url: '/game/record/find/gameRecord',
    body: { roomNumber },
  }),
  saveHandInfo: (handInfo: string[], nickName: any) => myRequest({
    url: '/generate_hand',
    body: { handInfo, nickName },
  }),
  downloadHands: (nickName: any) => myGetRequest({
    url: `/download_hands/${nickName}`,
  }),
};
