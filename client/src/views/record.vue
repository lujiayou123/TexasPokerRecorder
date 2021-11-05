<template>
  <div class="game-container container">
    <sitList :sitLink.sync='sitLink'
             :currPlayer="currPlayer"
             :commonCard="commonCard"
             @sit="sitDown"
             @buyIn="buyIn"
             :isPlay='isPlay'
             :valueCards='valueCards'
             :roomConfig ='roomConfig'
             :gameConfig="gameConfig"
             @delay="delay"
             :time.sync='time'
             :winner="winner"
             :actionUserId='actionUserId'
             :hand-card="handCard"
             :key="refreshSitList"></sitList>
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
  import fastClick from 'fastclick';
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
    // private postflopActionOrder: { [key: number]: string; } = {
    //     1: 'SB', 2: 'BB', 3: 'UTG', 4: 'UTG+1', 5: 'MP',
    //     6: 'LJ', 7: 'HJ', 8: 'CO', 9: 'BTN',
    //   };
    private postflopActionOrder: { [key: string]: number; } = {
        'SB': 1, 'BB': 2, 'UTG': 3, 'UTG+1': 4, 'MP': 5,
        'LJ': 6, 'HJ': 7, 'CO': 8, 'BTN': 9,
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
    private smallBlind: number = 0.5;
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
    private actionRoundComplete: boolean = false;
    private isShort: boolean = false;
    private refreshSitList: number = 0;
    private removedPlayers: Player[] = [];

    public getWinner() {
      if (this.currPlayerNode) {
        // only one winner, other players fold
        if (this.allInPlayers.length === 0 && this.playerSize === 1
          || this.allInPlayers.length === 1 && this.playerSize === 0) {
          console.log('only one player');
          this.gameOverType = EGameOverType.GAME_OVER;
          const winner = this.allInPlayers[0] || this.currPlayerNode.node;
          this.status = EGameStatus.GAME_OVER;
          this.winner.push([ winner ]);
          return;
        }
        // game show down
        while (this.status !== EGameStatus.GAME_SHOWDOWN) {
          this.sendCard();
          this.setSate();
        }

        this.status = EGameStatus.GAME_OVER;
        this.gameOverType = EGameOverType.GAME_SHOWDOWN;

        this.getPlayerPokerStyle();

        /**
         * The max player can't win all of pot, get the largest of the remaining players
         * @param {Player[]} excludePlayers - exclude players
         */
        const getOtherWinner = (excludePlayers: Player[]) => {
          // all player allin, winner can't get all pot
          const allPlayer = this.getPlayers('all', excludePlayers);
          // all player are exclude
          if (allPlayer) {
            if (allPlayer.length === 0) {
              return;
            }
            const maxLastPlayer = this.getMaxPlayers(allPlayer);
            this.winner.push(maxLastPlayer);
            if (this.getLeftoverPot() > 0) {
              getOtherWinner([ ...excludePlayers, ...maxLastPlayer ]);
            }
          }
          getOtherWinner([]);
          };
      }
    }

    private getPostFlopFirstActionPlayer(leftPlayers: Player[]): Player {
      let min = this.postflopActionOrder[leftPlayers[0].type];
      let firstPlayer = leftPlayers[0];
      // 循环找到firstPlayer
      for (const player of leftPlayers) {
        const val = this.postflopActionOrder[player.type];
        if (val <= min) {
          min = val;
          firstPlayer = player;
        }
      }
      return firstPlayer;
    }

    private getFirstActionPlayer() {
      if (this.playerLink) {
        let player;
        if (this.playerSize === 1) {
          player = this.allPlayer.filter((p) => p.counter > 0 && p.actionCommand !== 'fold')[0];
        } else {
          const leftPlayers = this.allPlayer.filter((p) => p.counter > 0
            && p.actionCommand !== 'fold');
          player = this.getPostFlopFirstActionPlayer(leftPlayers);
        }
        // console.log('getFirstActionPlayer-------player', player);
        this.currIndex = player.position;
        this.setCurrPlayerAction();
        // console.log('currIndex:', this.currIndex);
        // console.log('postFlop first Player:', player);
        let link: ILinkNode<Player> | null = this.playerLink.link;
        for (let i = 0; i < this.playerSize; i++) {
          if (link?.node.nickName === player?.nickName) {
            // console.log('getFirstActionPlayerLink', link);
            return link;
          }
          link = link?.next as ILinkNode<Player>;
        }
      // console.log('getFirstActionPlayerLink', link);
        return link;
      }
    }

    private isRemovedPlayer(position: string): boolean {
      const length = this.removedPlayers.length;
      if (length === 0) {
        return false;
      } else {
        for (let i = 0; i < length; i++) {
          if (this.removedPlayers[i].type === position) {
            return true;
          }
        }
        return false;
      }
    }

    private getRemovedPlayerByPosition(position: string) {
      const length = this.removedPlayers.length;
      for (let i = 0; i < length; i++) {
        if (this.removedPlayers[i].type === position) {
          return this.removedPlayers[i];
        }
      }
    }

    @Watch('actionRoundComplete')
    private actionRoundCompleteChange() {
      this.actionUserIdChange();
      this.actionRoundComplete = false;
    }

    @Watch('actionUserId')
    private actionUserIdChange() {
      // 监听player信息的变化，同步到sit，从而实时显示画面
      let sitHead = this.sitLink;
      let playerHead = this.playerLink?.link;
      // let playerHead = this.currPlayerNode;
      // if (playerHead) {
      //   console.log('sitHead', sitHead.node.player.type);
      //   console.log('playerHead', playerHead.node.type);
      //   console.log('playerSize', this.playerSize);
      //   console.log('removedPlayers', this.removedPlayers);
      // }
      // 这里默认了sitLink和playerLink长度一致，都等于this.playerNum
      for (let i = 0; i < this.playerNum; i++) {
        if (sitHead && playerHead && playerHead.next) {
          // sitHead永远是在UTG，因此在循环里，先判断sitHead对应的playerNode有没有被删除
          const sitHeadPostion = sitHead.node.player.type;
          // console.log('sitHeadPostion:', sitHeadPostion);
          // 如果被删除了
          if (this.isRemovedPlayer(sitHeadPostion)) {
            // console.log(sitHeadPostion + 'has been removed');
            // console.log('sitHead.node.player', sitHead.node.player);
            const removedPlayer = this.getRemovedPlayerByPosition(sitHeadPostion);
            // console.log('removedPlayer', removedPlayer);
            // console.log('sitHead', sitHead);
            sitHead.node.player.counter = removedPlayer?.counter;
            sitHead.node.player.actionSize = removedPlayer?.actionSize;
            sitHead.node.player.actionCommand = removedPlayer?.actionCommand;
            sitHead.node.player.status = removedPlayer?.status;
            sitHead = sitHead.next;
          } else { // 没被删除
          // 如果UTG call, UTG+1 fold
          // 此时sitHead在UTG，而PlayerHead在MP
          // 也就是说此处没有确保sitHead和playerHead同步
              for (let i = 0; i < this.playerSize; i++) {
                if (playerHead) {
                  // sitHead和playerHead同步
                  if (sitHead.node.player.type === playerHead.node.type) {
                    sitHead.node.player.counter = playerHead.node.counter;
                    sitHead.node.player.actionSize = playerHead.node.actionSize;
                    sitHead.node.player.actionCommand = playerHead.node.actionCommand;
                    sitHead.node.player.status = playerHead.node.status;
                    sitHead = sitHead.next;
                    if (playerHead.next) {
                      playerHead = playerHead.next;
                    }
                  } else {
                    if (playerHead.next) {
                      playerHead = playerHead.next;
                    }
                  }
                }
              }
            }
          }
      }
    }

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

    private removePlayer(currPlayer: Player) {
      // let playerLink: ILinkNode<Player>;
      if (this.playerLink) {
        let playerLink = this.playerLink.link;
        let player: ILinkNode<Player>;
        while (playerLink.next) {
          player = playerLink.next;
          // console.log(player.node.type);
          if (currPlayer.nickName === player.node.nickName) {
            const nextNext = playerLink.next.next;
            // player.next = null;
            this.removedPlayers.push(playerLink.next.node);
            playerLink.next = nextNext;
            this.playerSize--;
            this.playerLink.link = playerLink;
            // remove之后到BB -> remove之后到UTG+1
            if (this.playerLink.link.next) {
              this.playerLink.link = this.playerLink.link.next;
            }
            return;
          }
          playerLink = playerLink.next;
        }
      }
    }

    // node.next
    private nextPlayer() {
      // 切到下一个node
      if (this.currPlayerNode?.next) {
        this.currPlayerNode = this.currPlayerNode?.next;
      }
      // console.log('currPlayerNode', this.currPlayerNode);
      // 通过index修改currPlayer
      if (this.currPlayerNode) {
         this.currIndex = this.currPlayerNode.node.position;
      }
      // console.log('currPlayer', this.currPlayer);
      // 更新actionUserId，从而实时显示
      // if (this.currPlayer) {
      //   this.actionUserId = this.currPlayer.nickName;
      // }
    }

    private action(commandString: string) {
      // console.log('commandString', commandString);
      // console.log('this.status', this.status);
      // console.log('EGameStatus.GAME_ACTION', EGameStatus.GAME_ACTION);
      if (this.currPlayerNode) {
          if (this.status === EGameStatus.GAME_ACTION && this.currPlayerNode.next) {
          const commands = commandString.split(':');
          const command = commands[0];
          let size = Number(commands[1]);
          if (command === ECommand.ALL_IN) {
            // Counting player action size, if player's counter less than prevSize then use prevSize
            size = this.currPlayerNode.node.counter > this.prevSize ?
            this.currPlayerNode.node.counter : this.prevSize;
            this.currActionAllinPlayer.push(this.currPlayerNode.node);
            if (this.currPlayer) {
              // console.log(this.currPlayer);
              this.currPlayer.actionSize = size;
              this.currPlayer.counter -= size - this.currPlayer.inPot;
            }
            this.removePlayer(this.currPlayerNode.node);
            this.pot += this.currPlayerNode.node.counter;
            console.log(`${this.currPlayerNode.node.nickName} allin ${size} ${this.moneyType};\n`);
          }
          if (command === ECommand.CALL) {
            // size，下注量
            size = this.prevSize;
            // actinSize,加注量
            const actionSize = this.currPlayerNode.node.actionSize >= 0 ? this.currPlayerNode.node.actionSize : 0;
            // console.log('call----------', actionSize);
            if (this.currPlayer) {
              this.currPlayer.actionSize = size;
              this.currPlayer.counter -= size - actionSize;
            }
            this.pot += size - actionSize;
            console.log(`${this.currPlayerNode.node.nickName} calls ${size} ${this.moneyType};\n`);
          }
          if (command === ECommand.FOLD) {
            // if (this.currPlayer) {
            //   this.currPlayer.status = -1;
            // }
            this.currPlayerNode.node.actionCommand = 'fold';
            this.currPlayerNode.node.status = -1;
            this.currPlayerNode.node.actionSize = 0;
            this.removePlayer(this.currPlayerNode.node);
            // console.log('this.playerLink?.link', this.playerLink?.link);
            console.log(`${this.currPlayerNode.node.nickName} folds ;\n`);
          }
          if (command === ECommand.CHECK) {
            // prev player must be check
            if (!(this.prevSize <= 0 ||
              ((this.currPlayerNode.node.type === EPlayerType.BIG_BLIND
                || this.playerSize === 2 && this.currPlayerNode.node.type === EPlayerType.DEALER)
                && this.prevSize === this.smallBlind * 2))) {
              throw new Error('incorrect action: check');
            }
            console.log(`${this.currPlayerNode.node.nickName} checks;\n`);
            // console.log(this.currPlayerNode.node.type === EPlayerType.BIG_BLIND
            //   && this.prevSize === this.smallBlind * 2, 'big blind', this.currPlayerNode);
            // ???
            size = -1;
          }
          if (command === ECommand.RAISE) {
            // counter not enough raise
            if (size < this.prevSize * 2) {
              throw new Error(`incorrect action: raise ========= action size: ${this.currPlayerNode.node.actionSize}, prevSize: ${this.prevSize}`);
            }
            const prevActionSize = this.currPlayerNode.node.actionSize >= 0 ? this.currPlayerNode.node.actionSize : 0;
            // console.log('prevActionSize', this.currPlayerNode.node.actionSize);
            if (this.currPlayer) {
              this.currPlayer.actionSize = size;
              this.currPlayer.counter -= size - prevActionSize;
            }
            this.pot += (size - prevActionSize);
            console.log(`${this.currPlayerNode.node.nickName} raises ${size - prevActionSize - this.prevSize}${this.moneyType} to ${size - prevActionSize}${this.moneyType};\n`);
          }
          try {
            // clearTimeout(this.actionTimeOut);
            // console.log('commandString', commandString);
            // console.log('this.prevSize', this.prevSize);
            // console.log('breakPoint0');
            this.currPlayerNode.node.action(commandString, this.prevSize);
            // console.log('breakPoint1');
            const nextPlayer = this.currPlayerNode.next.node;
            // console.log('breakPoint2');
            // console.log(command, (nextPlayer.actionSize === this.prevSize
            //   && (nextPlayer.actionSize === this.currPlayerNode.node.actionSize || command === ECommand.FOLD)
            //   && this.prevSize !== this.smallBlind * 2 && this.prevSize !== 0), 'tst', size, nextPlayer.actionSize, this.prevSize);
            // all check actionSize === -1
            // all player allin
            // only 2 player, curr player fold, next player already action
            // only one player,one player fold,other player allin
            // pre flop big blind check and other player call
            // pre flop big blind fold and other player call
            if (this.isActionComplete(command, nextPlayer, size)) {
              console.log('actionComplete');
              this.actionComplete();
              return;
            }
            this.prevSize = command === ECommand.FOLD ? this.prevSize : size;
            // console.log('prevSize:', this.prevSize);
            this.nextPlayer();
            this.setCurrPlayerAction();
          } catch (e) {
            throw new Error('action:' + e);
          }
        } else {
          throw new Error('incorrect action flow');
        }
      }
      // this.nextPlayer();
    }

    private isActionComplete(command: any, nextPlayer: Player, size: number) {
      if (this.currPlayerNode) {
        if (this.playerSize === 0) {
          return true;
        }
      // left 1 player and not one allin player
      // left 1 player and current player allin, current counter small than prev player action size
      // left 1 player and has allin player, current player action size big than allin player action size
        if (this.playerSize === 1
        && (this.currActionAllinPlayer.length === 0
          || (command === ECommand.ALL_IN
            && this.prevSize <= nextPlayer.actionSize
            && this.currPlayerNode.node.actionSize < this.prevSize)
          || (command !== ECommand.ALL_IN && this.currPlayerNode.node.actionSize >= this.prevSize))) {
        return true;
      }
        if (this.commonCard.length !== 0 && nextPlayer.actionSize === this.smallBlind * 2
        && nextPlayer.actionSize === size && size === this.prevSize) {
        return true;
      }
        if (nextPlayer.actionSize === this.prevSize
        && (this.prevSize === this.currPlayerNode.node.actionSize || command === ECommand.FOLD)
        && this.prevSize !== this.smallBlind * 2 && this.prevSize !== 0) {
        return true;
      }
        if (this.commonCard.length === 0
        && (nextPlayer.actionSize === this.smallBlind * 2 && this.prevSize === nextPlayer.actionSize)
        && (this.currPlayerNode.node.type === EPlayerType.BIG_BLIND
          || (this.allPlayer.length === 2 && this.currPlayerNode.node.type === EPlayerType.DEALER))
        && (command === ECommand.CHECK || command === ECommand.FOLD)) {
        return true;
      }
        return false;
      }

    }

    private actionComplete() {
      // action has allin, sum the allin player ev_pot
      if (this.currActionAllinPlayer.length !== 0) {
        let currAllinPlayerPot = 0;
        this.currActionAllinPlayer.forEach((allinPlayer) => {
          this.allPlayer.forEach((p) => {
            const actionSize = p.actionSize > 0 ? p.actionSize : 0;
            if (actionSize < allinPlayer.actionSize) {
              currAllinPlayerPot += actionSize;
            } else {
              currAllinPlayerPot += allinPlayer.actionSize;
            }
          });
          console.log('evPot--------------------', this.prevPot, currAllinPlayerPot);
          allinPlayer.evPot = this.prevPot + currAllinPlayerPot;
          currAllinPlayerPot = 0;
        });
        this.allInPlayers = [ ...this.allInPlayers, ...this.currActionAllinPlayer ];
        this.allInPlayers.sort((prev, next) => prev.evPot - next.evPot);
        console.log('currActionAllinPlayer--------------------', this.allInPlayers, this.currActionAllinPlayer);
        // slide pot
        this.allInPlayers.forEach((p, key) => {
          if (key === 0) {
            this.slidePots.push(p.evPot);
          } else {
            this.slidePots.push(p.evPot - this.allInPlayers[key - 1].evPot);
          }
        });
      }
      // action complete clear player actionSize = 0
      this.clearPlayerAction();
      this.currActionAllinPlayer = [];
      this.prevSize = 0;
      this.prevPot = this.pot;
      // new action ring first action is sb
      this.currPlayerNode = this.getFirstActionPlayer();
      this.setSate();
      console.log(this.playerSize, 'playerS-------3', this.playerLink);
      if (this.status === EGameStatus.GAME_SHOWDOWN || this.playerSize <= 1) {
        setTimeout(() => {
          this.pokerGameOver();
        }, 300);
      }
      // action round complete, start auto action interval
      if (this.status < EGameStatus.GAME_SHOWDOWN && this.playerSize > 1) {
        this.actionEndTime = Date.now() + ACTION_TIME;
        this.sendCard();
        // this.startActionRound();
        this.setCurrPlayerAction();
      }
      // this.actionRoundComplete();
      this.actionRoundComplete = true;
    }

    private counting() {
      let prevEvPot = 0;
      this.winner.forEach((winnerList, key) => {
        winnerList.sort((prev, next) => prev.inPot - next.inPot);
        let roundPotCount = 0;
        winnerList.forEach((winner, index) => {
          const pot = winner.evPot >= this.pot ? this.pot : winner.evPot;
          const leftPot = pot - prevEvPot - roundPotCount;
          let income = Math.floor(leftPot / (winnerList.length - index));
          if (index === winnerList.length - 1) {
            // not only one winner
            if (index !== 0) {
              income = pot - roundPotCount;
            }
            winner.setIncome(income);
            prevEvPot = winner.evPot;
          } else {
            roundPotCount += income;
            winner.setIncome(income);
          }
          console.log('winner----------', winnerList, roundPotCount, pot, leftPot);
        });
      });
    }

    private pokerGameOver() {
      console.log('game over------------------');
      // 清除下注UI
      this.currIndex = -1;
      this.setCurrPlayerAction();
      // only one player,other fold
      this.getWinner();
      // todo counting
      this.counting();
      // this.initPlayer();
      // this.gameOverCallBack();
    }

    private setHandCard() {
      if (this.playerLink) {
        // send card start by small blind
        let playerLink = this.playerLink.link;
        // let sitLink = this.sitLink;
        let player: Player;
        for (let i = 0; i < 2; i++) {
          let j = 0;
          while (j < this.playerNum) {
            player = playerLink.node;
            const card = this.poker.getCard();
            player.setHandCard(card);
            if (playerLink.next) {
              playerLink = playerLink.next;
            }
            j++;
          }
        }
      }
    }

    private syncHandCard() {
      if (this.playerLink) {
        let playerLink = this.playerLink.link;
        let sitLink = this.sitLink;
        // console.log('playerLink', playerLink);
        // console.log('sitLink', sitLink);
        for (let i = 0; i < this.playerNum; i++) {
          sitLink.node.player.handCard = playerLink.node.handCard;
          if (playerLink.next) {
            playerLink = playerLink.next;
          }
          if (sitLink.next) {
            sitLink = sitLink.next;
          }
        }
      }
    }

    private sendCard() {
      if (this.status === EGameStatus.GAME_START) {
        this.setHandCard();
        // sync with UI
        this.syncHandCard();
        this.setSate();
        return;
      }
      if (this.status === EGameStatus.GAME_FLOP) {
        // fire card
        this.poker.getCard();
        for (let i = 0; i < 3; i++) {
          this.commonCard.push(this.poker.getCard());
        }
        this.setSate();
        return;
      }
      if (this.status === EGameStatus.GAME_TURN || this.status === EGameStatus.GAME_RIVER) {
        // fire card
        this.poker.getCard();
        this.commonCard.push(this.poker.getCard());
        this.setSate();
        return;
      }
      throw new Error('error flow sendCard');
    }

    private getMaxPlayers(lastPlayers: Player[]) {
      const _maxPlayers: Player[] = [];
      const maxPlayer = lastPlayers.reduce((acc, cur) => {
        return this.compareCard(acc, cur) === 1 ? acc : cur;
      });
      // has many winner equal max player
      lastPlayers.forEach((p) => {
        if (this.compareCard(p, maxPlayer) === 0) {
          _maxPlayers.push(p);
        }
      });
      return _maxPlayers;
    }

    private getPlayerPokerStyle() {
      // test
      // this.commonCard = [ 'j4', 'k4', 'l4', 'm4', 'i4', ];
      this.allPlayer.map((p) => {
        p.pokerStyle = new PokerStyle([ ...p.getHandCard(), ...this.commonCard ], this.isShort).getPokerWeight();
        return p;
      });
    }

    private getLeftoverPot() {
      if (this.winner.length === 0) {
        return this.pot;
      }
      return this.pot - this.winner[this.winner.length - 1][0].evPot;
    }


    private getPlayers(type= 'all', excludePlayers?: Player[]) {
      if (this.playerLink) {
        let players = [];
        let nextPlayer: ILinkNode<Player> = this.playerLink.link;
        let i = 0;
        while (i < this.playerSize) {
          players.push(nextPlayer.node);
          if (nextPlayer.next) {
            nextPlayer = nextPlayer.next;
          }
          i++;
        }
        players = type === 'all' ? [ ...players, ...this.allInPlayers ] : players;
        return excludePlayers ? players.filter((p) => {
          const isNotPlayer = excludePlayers.filter((excludePlayer) => excludePlayer.userId === p.userId
            || excludePlayer.evPot >= p.evPot);
          return isNotPlayer.length === 0;
        }) : players;
      }
    }

    private setSate() {
      if (this.status === EGameStatus.GAME_ACTION) {
        if (this.commonCard.length === 0) {
          this.status = EGameStatus.GAME_FLOP;
        }
        if (this.commonCard.length === 3) {
          this.status = EGameStatus.GAME_TURN;
        }
        if (this.commonCard.length === 4) {
          this.status = EGameStatus.GAME_RIVER;
        }
        if (this.commonCard.length === 5) {
          this.status = EGameStatus.GAME_SHOWDOWN;
        }
      } else {
        this.status = EGameStatus.GAME_ACTION;
      }
  }

    private compareCard(player: Player, targetPlayer: Player) {
      const firstWeight = player.pokerStyle;
      const lastWeight = targetPlayer.pokerStyle;
      let flag = -1;
      if (firstWeight > lastWeight) {
        flag = 1;
      }
      if (firstWeight === lastWeight) {
        flag = 0;
      }
      if (firstWeight < lastWeight) {
        flag = -1;
      }
      return flag;
    }

    // ui的sync是需要actionUserId改变的，所以单纯clearPlayerAction不能实时同步到UI
    private clearPlayerAction() {
      this.allPlayer.forEach((player) => {
        player.clearActionSize();
      });
      // this.setCurrPlayerAction();
    // this.currPlayerNode = this.playerLink?.getNode(8);
    // if (this.currPlayerNode) {
    //   this.currIndex = this.currPlayerNode.node.position;
    // }
    // this.startActionRound();
    // let sitHead = this.sitLink;
    // for (let i = 0; i < this.playerNum; i++) {
    //   sitHead.node.actionSize = 0;
    //   sitHead.node.actionCommand = '';
    //   sitHead = sitHead.next;
    // }
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
            console.log(`${this.SBPlayer.nickName} 放置小盲`);
            // this.SBPlayer.actionSize = 1;
            this.BBPlayer.action(`bb:${this.smallBlind * 2}`);
            console.log(`${this.BBPlayer.nickName} 放置大盲`);
            this.prevSize = this.smallBlind * 2;
            this.pot = this.smallBlind * 3;
            // todo straddle
          } else {
            throw new Error('player Inadequate');
          }
        }
      }

    private setPlayer(users: IPlayer[]) {
    // console.log('init player ======================================================', users);
    users.forEach((u, position) => {
      const player = new Player({
        ...u,
        position,
      });
      this.allPlayer.push(player);
    });
    return new Link<Player>(this.allPlayer);
  }

  private initPlayerLink() {
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
    // console.log('playerLink:', this.playerLink);
  }
    // 记录
    private record() {
      console.log('开始记录手牌');
      // 进入gaming的UI
      this.gaming = true;
      // 初始化PlayerLink
      this.initPlayerLink();
      // set playerSize
      this.playerSize = this.playerNum;
      // set SB, BB,Straddle
      this.setBlind();
      // set game status
      this.status = EGameStatus.GAME_START;
      // UTG第一个行动
      if (this.playerLink) {
        this.currPlayerNode = this.playerLink.getNode(0);
      }
      // console.log('currPlayerNode', this.currPlayerNode);
      if (this.currPlayerNode) {
        // 通过currIndex切换currPlayer
        this.currIndex = this.currPlayerNode.node.position;
      }
      // console.log('currPlayer', this.currPlayer);

      this.sendCard();
      this.setCurrPlayerAction();
    }

    private setCurrPlayerAction() {
      // let playerName = '';
      // let position = '';
      // if (this.currPlayerNode) {
      //   playerName = this.currPlayerNode.node.nickName;
      //   position = this.currPlayerNode.node.type;
      // }
      // console.log(`${position} ${playerName} 开始行动`);

      // 设置UI的当前行动者为currPlayer
      if (this.currPlayer) {
        // 通过currPlayer切换actionUserId
        // 同时，actionUserId会被监听，实时反馈到sit，形成切换玩家行动的效果
        this.actionUserId = this.currPlayer.nickName;
      }
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
