<template>
  <div class="game-container container">
    <sitList :sitLink.sync='sitLink'
             :currPlayer="currPlayer"
             :commonCard="commonCard"
             @sit="sitDown"
             @buyIn="buyIn"
             :isPlay='isPlay'
             :valueCards='valueCards'
             :roomConfig = 'roomConfig'
             :gameConfig="gameConfig"
             @delay="delay"
             :time.sync='time'
             :winner="winner"
             :actionUserId='actionUserId'
             :hand-card="handCard"></sitList>
    <common-card
      :commonCard="commonCard"
      :valueCards='valueCards'
    ></common-card>
    <notice :message-list="messageList"></notice>
    <div class="winner-poke-style"
         v-show="gameOver && winner[0][0].handCard.length > 0">
      {{PokeStyle(winner[0] && winner[0][0] && winner[0][0].handCard)}} WIN!!
    </div>
    <div class="game-body">
      <div class="pot">pot: {{pot}}</div>
      <!-- <div class="roomId">No.:{{roomId}}</div> -->
      <!-- <div class="btn play"
           v-show="isOwner && !isPlay"><span @click="play">play game</span></div>
    </div> -->
      <div class="btn play"
           v-show="!isPlay"><span @click="record">开始记录</span></div>
    </div>
    <!-- <div class="game-record iconfont icon-record" @click="getRecord(0)"></div> -->
    <actionDialog :base-size="baseSize"
                  :curr-player="currPlayer"
                  :is-action="isAction"
                  :is-pre-flop="commonCard.length === 0"
                  :min-action-size="minActionSize"
                  :is-two-player="gamePlayers.length === 2"
                  :pot="pot"
                  :prev-size="prevSize"
                  @action = 'action'
    ></actionDialog>
    <!-- <div class="setting">
      <div class="iconfont icon-setting setting-btn"
           @click="showSetting = true"></div>
      <div class="setting-body"
           :class="{show: showSetting}">
        <i @click="showBuyInDialog()">buy in</i>
        <i @click="standUp()">stand Up</i>
        <i @click="showCounterRecord">counter record</i>
      </div>
    </div> -->
    <BuyIn :showBuyIn.sync='showBuyIn'
           :min='0'
           :max='baseSize * 2000'
           @buyIn='buyIn'></BuyIn>
    <toast :show.sync="showMsg"
           :text="msg"></toast>
    <record :players="players"
            v-model="showRecord"></record>
    <!-- <sendMsg @send = 'sendMsgHandle' :msg-list="msgListReverse"></sendMsg> -->
<!--    <iAudio :play="playIncome" type="income"></iAudio>-->
    <gameRecord v-model="showCommandRecord"
                :game-list="gameList"
                @getRecord = "getRecord"
                :curr-game-index="currGameIndex"
                :command-list="commandRecordList"></gameRecord>
  </div>
</template>

<script lang="ts">
  import { Vue, Watch } from 'vue-property-decorator';
  import Component from 'vue-class-component';
  import io from 'socket.io-client';
  import cookie from 'js-cookie';
  // 自定义
  import sitList from '../components/CustomSitList.vue';
  // import sitList from '../components/SitList.vue';
  import commonCard from '../components/CommonCard.vue';
  import { ILinkNode, Link } from '@/utils/Link';
  import ISit from '../interface/ISit';
  import BuyIn from '../components/BuyIn.vue';
  import toast from '../components/Toast.vue';
  import record from '../components/Record.vue';
  import notice from '../components/Notice.vue';
  import iAudio from '../components/Audio.vue';
  import sendMsg from '../components/SendMsg.vue';
  import actionDialog from '../components/Action.vue';
  import { PokerStyle } from '@/utils/PokerStyle';
  import origin from '../utils/origin';
  import { IRoom } from '@/interface/IRoom';
  import service from '../service';
  import gameRecord from '@/components/GameRecord.vue';
  import {IGameRecord} from '@/interface/IGameRecord';
  import { IPoker, Poker } from '../core/Poker';
  import { EPlayerType, Player, IPlayer } from '../core/Player';
  import Timeout = NodeJS.Timeout;

  interface IPokerGame {
    users: Player[];
    smallBlind: number;
    isShort: boolean;
    actionRoundComplete: () => void;
    gameOverCallBack: () => void;
    autoActionCallBack: (actionType: string, userId: string) => void;
  }

  /**
   * Game over enum
   */
  export enum EGameOverType {
    GAME_SHOWDOWN = 1,
    GAME_OVER = 2,
  }

  /**
   * Game state enum
   */
  export enum EGameStatus {
    GAME_READY,
    GAME_START,
    GAME_FLOP,
    GAME_TURN,
    GAME_RIVER,
    GAME_ACTION,
    GAME_SHOWDOWN,
    GAME_OVER,
  }

  export enum ECommand {
    SMALL_BLIND = 'SB',
    BIG_BLIND = 'BB',
    STRADDLE = 'Straddle',
    CALL   = 'call',
    ALL_IN = 'allin',
    RAISE  = 'raise',
    CHECK  = 'check',
    FOLD   = 'fold',
  }

  interface IMsg {
    action: string;
    clients: string[];
    target: string;
    message?: any;
    data: any;
  }

  const GAME_BASE_SIZE = 1;
  const ACTION_TIME = 999;

  @Component({
    components: {
      sitList,
      commonCard,
      BuyIn,
      toast,
      record,
      gameRecord,
      notice,
      iAudio,
      actionDialog,
      sendMsg,
    },
  })
  export default class Record extends Vue {

    get msgListReverse() {
      const msg = JSON.parse(JSON.stringify(this.messageList));
      return msg.reverse();
    }

    get isPlay() {
      return this.gaming || this.pot !== 0;
    }

    get roomId() {
      return this.$route.params.roomNumber;
    }

    get isOwner() {
      return !!this.$route.params.isOwner;
    }

    get gameOver() {
      return this.winner.length !== 0;
    }

    get isAction() {
      return this.currPlayer?.nickName === this.actionUserId;
    }

    get valueCards() {
      if (this.gameOver && this.winner[0] && this.winner[0][0].handCard) {
        const handCards = this.winner[0][0].handCard;
        const style = new PokerStyle([...handCards, ...this.commonCard], this.roomConfig.isShort);
        return style.getPokerValueCard();
      } else {
        return [];
      }
    }

    get gamePlayers() {
      if (!this.isPlay) {
        return [];
      }
      return this.sitList.filter((s) => s.player && s.player.status === 1);
    }

    get hasSit() {
      return !!this.sitList.find((s) => s.player && s.player.userId === this.currPlayer?.userId);
    }

    get currPlayer() {
      // return this.players.find((u: Player) => this.userInfo.userId === u.userId);
      // return this.players.find((u: Player) => this.currPosition === u.type);
      return this.players.find((u: Player) => this.currIndex === u.position);
    }
    // get SBPlayer() {
    //   return this.players.find((u: IPlayer) => 'SB' === u.type);
    // }
    // get BBPlayer() {
    //   return this.players.find((u: IPlayer) => 'BB' === u.type);
    // }

    get minActionSize() {
      return this.prevSize <= 0 ? this.baseSize * 2 : this.prevSize * 2;
    }

    get baseSize() {
      // return this.roomConfig.smallBlind || GAME_BASE_SIZE;
      return this.smallBlind || GAME_BASE_SIZE;
    }
    public socket: any = null;
    // gameConfig
    private gameConfig: any;
    // in the room user
    // have a sit user
    private players: Player[] = [];
    private userInfo: any = {};
    private currPosition: string = '';
    private currIndex: number = 0;
    private positionDict: { [key: number]: string; } = {
        1: 'UTG', 2: 'UTG+1', 3: 'MP', 4: 'LJ', 5: 'HJ',
        6: 'CO', 7: 'BTN', 8: 'SB', 9: 'BB',
      };
    private preflopActionOrder: { [key: number]: string; } = {
        1: 'UTG', 2: 'UTG+1', 3: 'MP', 4: 'LJ', 5: 'HJ',
        6: 'CO', 7: 'BTN', 8: 'SB', 9: 'BB',
      };
    private postflopActionOrder: { [key: number]: string; } = {
        1: 'SB', 2: 'BB', 3: 'UTG', 4: 'UTG+1', 5: 'MP',
        6: 'LJ', 7: 'HJ', 8: 'CO', 9: 'BTN',
      };

    private joinMsg = '';
    private handCard = [];
    private showBuyIn = false;
    private showSetting = false;
    // private sitLink: any = '';
    private sitLink: any = '';
    private gaming = false;
    private sitList: ISit[] = [];
    private actionUserId = '';
    private showAllin = false;
    private showMsg = false;
    // private playIncome = false;
    private msg = '';
    private time = ACTION_TIME;
    private timeSt: number = 0;
    private commandRecordList = [];
    private actionEndTime = 0;
    private showCommandRecord = false;
    private gameList: IGameRecord [] = [];
    private currGameIndex = 0;
    private roomConfig: IRoom = {
      isShort: false,
      smallBlind: 1,
    };
    private messageList: any[] = [];
    private showRecord = false;
    private handInfo: string[] = [];
    private moneyType: string = '$';
    private playerNum: number = 9;
    private smallBlind: number = 1;
    private isPreflop: boolean = true;
    private isPostflop: boolean = false;
    private board = [];
    private isRoundComplete: boolean = false;
    // private playerLink: Link<Player> = new Link<Player>(this.players);
    private playerLink?: Link<Player>;
    private poker: IPoker = new Poker();
    private prevPot: number = 0;
    private currActionAllinPlayer: Player[] = [];
    private slidePots: number [] = [];
    private prevSize: number = 0;
    // public currPlayer: ILinkNode<Player>;
    private allInPlayers: Player[] = [];
    private playerSize: number = 0;
    private pot: number = 0;
    private status: EGameStatus = EGameStatus.GAME_READY;
    private commonCard: string[] = [];
    private winner: Player[][] = [];
    private allPlayer: Player[] = [];
    private gameOverType: EGameOverType = EGameOverType.GAME_SHOWDOWN;
    private SBPlayer?: Player;
    private BBPlayer?: Player;
    private currPlayerNode?: ILinkNode<Player>;
    // private readonly actionRoundComplete: () => void;
    // private readonly gameOverCallBack: () => void;
    // private readonly autoActionCallBack: (actionType: string, userId: string) => void;

    // @Watch('players')
    // private playerChange(players: Player[]) {
    //   console.log('player change-------');
    //   this.sitList = this.sitList.map((sit: ISit) => {
    //     const player = players.find(
    //       (p) => sit.player && p.userId === sit.player.userId && sit.player.counter > 0);
    //     return Object.assign({}, {}, { player, position: sit.position }) as ISit;
    //   });
    //   this.initSitLink();
    // }

    // @Watch('isPlay')
    // private isPlayChange(val: boolean) {
    //   if (val) {
    //     clearTimeout(this.timeSt);
    //     this.doCountDown();
    //   }
    // }

    // @Watch('currIndex')
    // private isCurrIndexChange(val: number) {
    //   if (val) {
    //     console.log('currIndex Change to:', val);
    //     this.currPosition = this.positionDict[val];
    //     console.log('currPosition:', this.currPosition);
    //     console.log('currPlayer:', this.currPlayer);
    //     // 如果val到10，且没有结束行动
    //   }
    // }

    @Watch('actionUserId')
    private actionUserIdChange() {
      // if (this.isPlay && this.actionEndTime) {
      //   console.log('action player change-------', this.actionEndTime);
      //   const now = Date.now();
      //   this.time = Math.floor((this.actionEndTime - now) / 1000);
      //   clearTimeout(this.timeSt);
      //   this.doCountDown();
      // }
      // 监听player信息的变化，同步到sit，从而实时显示画面
      let sitHead = this.sitLink;
      let playerHead = this.playerLink?.link;
      for (let i = 0; i < this.playerNum; i++) {
        if (sitHead && playerHead && playerHead.next) {
          sitHead.node.player.counter = playerHead.node.counter;
          sitHead.node.player.actionSize = playerHead.node.actionSize;
          sitHead.node.player.actionCommand = playerHead.node.actionCommand;
          sitHead.node.player.status = playerHead.node.status;
          sitHead = sitHead.next;
          playerHead = playerHead.next;
        }
      }
    }

    // @Watch('playerLink')
    // // 监听player信息的变化，同步到sit，从而实时显示画面
    // private playerLinkSyncSitLink() {
    //   console.log('playerLinkChange');
    //   let sitHead = this.sitLink;
    //   let playerHead = this.playerLink?.link;
    //   for (let i = 0; i < this.playerNum; i++) {
    //     if (sitHead && playerHead && playerHead.next) {
    //       sitHead.node.player.counter = playerHead.node.counter;
    //       sitHead.node.player.actionSize = playerHead.node.actionSize;
    //       sitHead.node.player.actionCommand = playerHead.node.actionCommand;
    //       sitHead.node.player.status = playerHead.node.status;
    //       sitHead = sitHead.next;
    //       playerHead = playerHead.next;
    //     }
    //   }
    // }

    private init() {
      this.initSitLink(); // 为每个座位玩家进行相应设置，并得到this.sitLink
      this.joinMsg = '';
      this.handCard = [];
      this.commonCard = [];
      this.pot = 0;
      this.prevSize = 0;
      this.time = ACTION_TIME;
      this.winner = [];
      this.showBuyIn = false;
      const gameConfig = cookie.get('gameConfig') || localStorage.getItem('gameConfig') || '';
      this.gameConfig = JSON.parse(gameConfig);
      this.playerNum = this.gameConfig.playerNum;
      this.smallBlind = this.smallBlind;
      this.moneyType = this.gameConfig.moneyType;
    }

    private sendMsgHandle(msgInfo: string) {
      const msg = `${this.userInfo.nickName}:${msgInfo}`;
      // this.emit('broadcast', { msg });
    }

    private showCounterRecord() {
      this.showRecord = true;
      this.showSetting = false;
    }

    private doCountDown() {
      if (this.time <= 0) {
        clearTimeout(this.timeSt);
        return;
      }
      // this.timeSt = setTimeout(() => {
      //   const now = Date.now();
      //   this.time = Math.floor((this.actionEndTime - now) / 1000);
      //   this.doCountDown();
      // }, 1000);
    }

    private PokeStyle(cards: string[]) {
      if (this.commonCard.length === 0 || !cards) {
        return '';
      }
      const commonCards = this.commonCard || [];
      const card = [...cards, ...commonCards];
      const style = new PokerStyle(card, this.roomConfig.isShort);
      return style.getPokerStyleName();
    }

    private showBuyInDialog() {
      this.showBuyIn = true;
      this.showSetting = false;
    }

    private sitListMap() {
      let node = this.sitLink;
      const sit = [];
      for (let i = 0; i < 9; i++) {
        sit.push(node.node);
        const next = node.next;
        node = next;
      }
      return sit;
    }

    private sitDown() {
      // this.emit('sitDown', { sitList: this.sitListMap() });
    }

    private delay() {
      // this.emit('delayTime');
    }

    private action(command: string) {
      // console.log('最少下注', this.prevSize);
      // if (this.currPlayer) {
      //   console.log(`${this.currPlayer.nickName} ${command}`);
      // }
      if (command === 'call') {
        this.pot = this.pot + this.prevSize;
        if (this.currPlayer) {
          this.currPlayer.actionSize = this.prevSize;
          this.currPlayer.counter -= this.prevSize;
          const infoString = `${this.currPlayer?.nickName} calls ${this.prevSize}${this.moneyType};\n`;
          this.handInfo.push(infoString);
          console.log(infoString);
        }
      }

      if (command.substring(0, 5) === 'raise') {
        const raiseTo = Number(command.substring(6));
        const raiseNum = raiseTo - this.prevSize;
        this.pot += raiseTo;
        this.prevSize = raiseTo;
        if (this.currPlayer) {
          this.currPlayer.actionSize = raiseTo;
          this.currPlayer.counter -= raiseTo;
          // this.currPlayer.status = 1;
        }
        // console.log('raiseNum', raiseNum);
        // console.log('raiseTo', raiseTo);
        // console.log(`${command}`);
        const infoString = `${this.currPlayer?.nickName} raise ${raiseNum}${this.moneyType} to ${raiseTo}${this.moneyType};\n`;
        this.handInfo.push(infoString);
        console.log(infoString);
        // console.log('handInfo', this.handInfo);
      }
      if (command === 'fold') {
        if (this.currPlayer) {
          this.currPlayer.status = -1;
        }
      }
      // TODO allin多三块钱
      if (command === 'allin') {
        this.showAllin = true;
        // setTimeout(() => {
        //   this.showAllin = false;
        // }, 3000);


        if (this.currPlayer) {
          const raiseTo = this.currPlayer?.counter + this.currPlayer?.actionSize;
          // const raiseTo = this.currPlayer?.counter;
          const raiseNum = raiseTo - this.currPlayer?.actionSize;
          console.log('allin加注量', raiseNum);
          this.pot += raiseNum;
          if (raiseTo > this.prevSize) {
            this.prevSize = raiseTo;
          }
          this.currPlayer.actionSize = raiseTo;
          this.currPlayer.counter -= raiseTo;
          const infoString = `${this.currPlayer?.nickName} raise ${raiseNum}${this.moneyType} to ${raiseTo}${this.moneyType};\n`;
          this.handInfo.push(infoString);
          console.log(infoString);
          // this.currPlayer.status = 1;
        }
        // console.log('raiseNum', raiseNum);
        // console.log('raiseTo', raiseTo);
        // console.log(`${command}`);

      }
      // this.isAction = false;
      // this.isRaise = false;

      // 不管执行了什么动作，跳到下一位玩家
      this.nextPlayerTakeAction();
    }

    private nextPlayerTakeAction() {
      this.currIndex += 1;
      // 一轮玩家行动后，检查这条街是否结束
      if (this.currIndex >= this.playerNum + 1) {
        this.isRoundComplete = this.checkRoundComplete();
        if (this.isRoundComplete) {
          this.currIndex = this.playerNum - 2;
        } else {
          this.currIndex = 1;
        }
      }
      this.getCurrPostionByCurrIndex(this.currIndex);
      if (this.currPlayer) {
        // 弹出行动条,check call raise fold
        this.actionUserId = this.currPlayer.nickName;
      }
      // console.log('actionUserId:', this.currPlayer?.nickName);
      // console.log('轮到玩家:', this.currPlayer?.nickName);
      // console.log('当前Index:', this.currIndex);
    }

    private async buyIn(size: number) {
      if (size <= 0) {
        this.$plugin.toast('buy in size too small');
        return;
      }

      try {
        console.log('come in buyIn ==================', size);
        this.showMsg = true;
        this.msg = this.hasSit && this.isPlay
          ? `已补充买入 ${size},下局生效` : `已补充买入 ${size}`;
        // this.emit('buyIn', {
        //   buyInSize: size,
        // });
      } catch (e) {
        console.log(e);
      }
    }
    private standUp() {
      // player in the game
      if (this.currPlayer && this.currPlayer.status === 1) {
        this.$plugin.toast('sorry, please fold you hand!');
        return;
      }
      // this.emit('standUp');
      this.showSetting = false;
    }

    private play() {
      if (this.players.length >= 2) {
        this.gaming = true;
        // this.emit('playGame');
      } else {
        console.log('no enough player');
      }
    }

    private setBlind() {
        console.log('放置大小盲');
        // sb blind
        if (this.playerLink) {
          // Sb在倒数第二
          const SBPlayerNode = this.playerLink.getNode(this.playerNum - 2);
          this.SBPlayer = SBPlayerNode.node;
          if (SBPlayerNode.next) {
            // big blind
            const BBPlayerNode: ILinkNode<Player> = SBPlayerNode.next;
            this.BBPlayer = BBPlayerNode.node;
            this.SBPlayer.action(`sb:${this.smallBlind}`);
            // this.SBPlayer.actionSize = 1;
            this.BBPlayer.action(`bb:${this.smallBlind * 2}`);
            this.prevSize = this.smallBlind * 2;
            this.pot = this.smallBlind * 3;
            // todo straddle
          } else {
            throw new Error('player Inadequate');
          }
        }
      }

    private setPlayer(users: IPlayer[]) {
    console.log('init player ======================================================', users);
    users.forEach((u, position) => {
      const player = new Player({
        ...u,
        position,
      });
      this.allPlayer.push(player);
    });
    return new Link<Player>(this.allPlayer);
  }
    // 记录
    private record() {
      console.log('开始记录手牌');
      this.gaming = true;


      // this.pot = 3;
      // this.prevSize = 2;
      // this.isPreflop = true;
      // this.isPostflop = false;
      // console.log('baseSize:', this.baseSize);
      // console.log('prevSize:', this.prevSize);
      // console.log('minActionSize:', this.minActionSize);


      // this.players是由this.sitLink组成的，所以不能和this.playerLink同步
      let sitLinkHead = this.sitLink;
      const IPlayers: IPlayer[] = [];
      for (let i = 0; i < this.playerNum; i++) {
        const iplayer = sitLinkHead.node.player;
        IPlayers.push(iplayer);
        sitLinkHead = sitLinkHead.next;
      }
      // init playerLink
      this.playerLink = this.setPlayer(IPlayers);
      // set this.players
      let playerLinkHead = this.playerLink.link;
      // console.log('playerLinkHead', playerLinkHead);
      for (let i = 0; i < this.playerNum; i++) {
        const player = playerLinkHead.node;
        this.players.push(player);
        if (playerLinkHead.next) {
          playerLinkHead = playerLinkHead.next;
        } else {
          console.log('detect playerLinkHead.next is null');
        }
      }
      console.log('players:', this.players);
      // set playerSize
      this.playerSize = this.playerNum;
      // set SB, BB,Straddle
      this.setBlind();
      // set game status
      this.status = EGameStatus.GAME_READY;
      //
      // this.currPosition = 'UTG';
      this.currIndex = 0;
      console.log('currPlayer', this.currPlayer);
      if (this.currPlayer) {
        this.actionUserId = this.currPlayer.nickName;
      }
      // console.log('playerLink', this.playerLink);
      // console.log('sitLink', this.sitLink);
      // console.log('playerNode8', this.playerLink.getNode(8));
      // console.log('sitNode8', this.getSitLinkNode(8));
    }

    private getSitLinkNode(position: number) {
      let linkNode = this.sitLink;
      let i = 0;
      while (linkNode.next) {
        if (i === position) {
          return linkNode;
        }
        linkNode = linkNode.next;
        i++;
      }
      return linkNode;
    }

    private getRandomId(length: number): string {
      const str = '0123456789abcdefghijklmnopqrstuvwxyz';
      let randomId = '';
      for (let i = 9; i > 0; --i) {
        randomId += str[Math.floor(Math.random() * str.length)];
      }
      return randomId;
    }

    private checkRoundComplete(): boolean {
      for (let i = 0; i < this.playerNum; i++) {
        // 没有弃牌
        if (this.players[i].status !== -1) {
          if (this.players[i].actionSize !== this.prevSize) {
            console.log('Round Not Complete');
            return false;
          }
        }
      }
      console.log('Round Complete');
      return true;
    }

    // private positionDict(position: number): string {
    //   const positionDict: { [key: number]: string; } = {
    //     1: 'UTG', 2: 'UTG+1', 3: 'MP', 4: 'LJ', 5: 'HJ',
    //     6: 'CO', 7: 'BTN', 8: 'SB', 9: 'BB',
    //   };
    //   return positionDict[position];
    // }

    private blindDict(position: string): number {
      const blindDict: { [key: string]: number; } = {
        'BTN': 0, 'SB': 1, 'BB': 2, 'UTG': 0, 'UTG+1': 0, 'MP': 0, 'LJ': 0, 'HJ': 0, 'CO': 0,
      };
      return blindDict[position];
    }
    private counterDict(position: number): number {
      const counterDict: { [key: number]: number; } = {
          1: 2000 * this.smallBlind,
          2: 2000 * this.smallBlind,
          3: 2000 * this.smallBlind,
          4: 2000 * this.smallBlind,
          5: 2000 * this.smallBlind,
          6: 2000 * this.smallBlind,
          7: 2000 * this.smallBlind,
          8: 2000 * this.smallBlind,
          9: 2000 * this.smallBlind,
          // 8: 2000 * this.smallBlind - 1,
          // 9: 2000 * this.smallBlind - 2,
        };
      return counterDict[position];
    }
    private initSitLink() {
      // this.prevSize = this.smallBlind * 2;
      const sb = this.smallBlind;
      const bb = 2 * sb;
      const sitListMap = this.sitList || [];
      if (sitListMap.length === 0) {
        for (let i = 0; i < 9; i++) {
          const sit = {
            player: {
              counter: this.counterDict(i + 1),
              nickName: this.getRandomId(8),
              type: this.positionDict[i + 1],
              // actionSize: this.blindDict(this.positionDict[i + 1]),
              actionSize: 0,
              actionCommand: '',
              buyIn: 1000 * bb,
              status: 1,
              isSit: true,
              delayCount: 999,
            },
            position: i,
          };
          sitListMap.push(sit);
        }
      }
      const link = new Link<ISit>(sitListMap).link;
      // for (let i = 0; i < 9; i++) {
      //   if (link.node.player
      //     && link.node.player.userId === this.currPlayer?.userId) {
      //     this.sitLink = link;
      //     return;
      //   }
      //   const next = link.next;
      //   link = next as ILinkNode<ISit>;
      // }
      this.sitLink = link;
    }

    private async getRecord(index: number) {
      try {
        let gameId = 0;
        if (!index) {
          const result = await service.gameRecordList(this.roomId);
          this.gameList = Object.values(result.data);
          gameId = this.gameList[this.gameList.length - 1].gameId;
          this.currGameIndex = this.gameList.length;
          console.log('ccc len', this.gameList.length);
        } else {
          this.currGameIndex = index;
          gameId = this.gameList[index - 1].gameId;
        }
        console.log(gameId, 'ccc11');
        const { data } = await service.commandRecordList(this.roomId, gameId);
        this.commandRecordList = data.commandList;
        this.showCommandRecord = true;
        console.log(data);
      } catch (e) {
        console.log(e);
        this.$plugin.toast('can\'t find the room');
      }
    }

    // 生命周期created
    private created() {
      this.init();
    }

    private getCurrPostionByCurrIndex(currIndex: number) {
      this.currPosition = this.preflopActionOrder[currIndex];
      // console.log('getCurrPostionByCurrIndex, this.currPosition:', this.currPosition);
    }

    private logHandInfo() {
      console.log('handInfo', this.handInfo);
      const length = this.handInfo.length;
      for (let i = 0; i < length; i++) {
        console.log(this.handInfo[i]);
      }
    }
  }
</script>

<style lang="less"
       scoped>
  .game-container {
    background: radial-gradient(#00bf86, #006a55);
    background-size: 100% 100%;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    .winner-poke-style {
      position: absolute;
      top: 55vh;
      left: 50%;
      transform: translate3d(-50%, 0, 0);
      z-index: 0;
      font-size: 14px;
      color: #fff;
    }

    .game-body {
      position: absolute;
      top: 38vh;
      left: 50%;
      transform: translate3d(-50%, -50%, 0);
      z-index: 0;

      .roomId {
        margin-top: 10px;
        font-size: 14px;
      }
    }

    .setting {
      left: 0;
      top: 0;
      position: absolute;

      .setting-btn {
        width: 30px;
        height: 30px;
        line-height: 30px;
        text-align: center;
        background: #fff;
        top: 10px;
        left: 0;
        position: absolute;
        font-size: 20px;
        color: #898888;
        border-radius: 0 10px 10px 0;
      }

      .setting-body {
        position: absolute;
        left: 0;
        top: 0;
        transform: translate3d(-150px, 0px, 0px);
        z-index: 1;
        transition: transform .5s;

        i {
          display: block;
          width: 100px;
          height: 20px;
          padding: 4px;
          font-style: normal;
          text-align: left;
          line-height: 20px;
          font-size: 12px;
          color: #fff;
          background: rgba(0, 0, 0, 0.6);
          margin: 1px 0;
        }

        &.show {
          transform: translate3d(0, 0, 0);
        }
      }
    }
    .game-record{
      position: absolute;
      right: 10px;
      top: 7px;
      font-size: 36px;
      color: #fff;
    }
  }
</style>
