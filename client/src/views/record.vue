<template>
  <div class="game-container container">
    <div class="return">
      <el-button type="info" @click="returnHome">返回</el-button>
    </div>
    <sitList
      :sitLink.sync="sitLink"
      :currPlayer="currPlayer"
      :commonCard="commonCard"
      @sit="sitDown"
      @buyIn="buyIn"
      :isPlay="isPlay"
      :valueCards="valueCards"
      :roomConfig="roomConfig"
      :gameConfig="gameConfig"
      @delay="delay"
      :smallBlind="smallBlind"
      :time.sync="time"
      :displayByBigBlind.sync="displayByBigBlind"
      :winner="winner"
      :actionUserId="actionUserId"
      :hand-card="handCard"
      :key="refreshSitList"
    ></sitList>
    <common-card
      :commonCard="commonCard"
      :valueCards="valueCards"
    ></common-card>
    <notice :message-list="messageList"></notice>
    <div
      class="winner-poke-style"
      v-show="
        gameOver && winner[0][0].handCard && winner[0][0].handCard.length > 0
      "
    >
      <!-- {{PokeStyle(winner[0] && winner[0][0] && winner[0][0].handCard)}} WIN!! -->
      {{ winner[0] && winner[0][0] && winner[0][0].nickName }} WIN!!
    </div>
    <div class="game-body">
      <div class="pot" @click="switchDisplayMode">
        pot: {{ displayPot }}{{ displayMoneyType }}
      </div>
      <!-- <div class="roomId">No.:{{roomId}}</div> -->
      <!-- <div class="btn play"
           v-show="isOwner && !isPlay"><span @click="play">play game</span></div>
    </div> -->
      <div class="btn play" v-show="!isPlay">
        <span @click="record">开始记录</span>
      </div>
    </div>
    <!-- <div class="game-record iconfont icon-record" @click="getRecord(0)"></div> -->
    <actionDialog
      :base-size="baseSize"
      :curr-player="currPlayer"
      :is-action="isAction"
      :is-pre-flop="commonCard.length === 0"
      :min-action-size="minActionSize"
      :is-two-player="gamePlayers.length === 2"
      :pot="pot"
      :prev-size="prevSize"
      @action="action"
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
    <BuyIn
      :showBuyIn.sync="showBuyIn"
      :min="0"
      :max="baseSize * 2000"
      @buyIn="buyIn"
    >
    </BuyIn>
    <InputFlop
      :showInputFlop.sync="showInputFlop"
      @TransferFlopToRecord="getFlop"
    >
    </InputFlop>
    <InputTurn
      :showInputTurn.sync="showInputTurn"
      @TransferTurnToRecord="getTurn"
    >
    </InputTurn>
    <InputRiver
      :showInputRiver.sync="showInputRiver"
      @TransferRiverToRecord="getRiver"
    >
    </InputRiver>
    <toast :show.sync="showMsg" :text="msg"> </toast>
    <record :players="players" v-model="showRecord"> </record>
    <!-- <sendMsg @send = 'sendMsgHandle' :msg-list="msgListReverse"></sendMsg> -->
    <!--    <iAudio :play="playIncome" type="income"></iAudio>-->
    <gameRecord
      v-model="showCommandRecord"
      :game-list="gameList"
      @getRecord="getRecord"
      :curr-game-index="currGameIndex"
      :command-list="commandRecordList"
    >
    </gameRecord>
  </div>
</template>

<script lang="ts">
import { Vue, Watch } from "vue-property-decorator";
import Component from "vue-class-component";
import io from "socket.io-client";
import cookie from "js-cookie";
// 自定义
import sitList from "../components/CustomSitList.vue";
// import sitList from '../components/SitList.vue';
import commonCard from "../components/CommonCard.vue";
import { ILinkNode, Link } from "@/utils/Link";
import ISit from "../interface/ISit";
import BuyIn from "../components/BuyIn.vue";
import toast from "../components/Toast.vue";
import record from "../components/Record.vue";
import notice from "../components/Notice.vue";
import iAudio from "../components/Audio.vue";
import sendMsg from "../components/SendMsg.vue";
import actionDialog from "../components/Action.vue";
import { PokerStyle } from "@/utils/PokerStyle";
import origin from "../utils/origin";
import { IRoom } from "@/interface/IRoom";
import service from "../service";
import gameRecord from "@/components/GameRecord.vue";
import { IGameRecord } from "@/interface/IGameRecord";
import { IPoker, Poker } from "../core/Poker";
import { EPlayerType, Player, IPlayer } from "../core/Player";
import fastClick from "fastclick";
import Timeout = NodeJS.Timeout;
import { Console } from "console";
import InputFlop from "@/components/InputFlop.vue";
import InputTurn from "@/components/InputTurn.vue";
import InputRiver from "@/components/InputRiver.vue";

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
  SMALL_BLIND = "SB",
  BIG_BLIND = "BB",
  STRADDLE = "Straddle",
  CALL = "call",
  ALL_IN = "allin",
  RAISE = "raise",
  CHECK = "check",
  FOLD = "fold",
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
    InputFlop,
    InputTurn,
    InputRiver,
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
      const style = new PokerStyle(
        [...handCards, ...this.commonCard],
        this.roomConfig.isShort
      );
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
    return !!this.sitList.find(
      (s) => s.player && s.player.userId === this.currPlayer?.userId
    );
  }

  get currPlayer() {
    // return this.players.find((u: Player) => this.userInfo.userId === u.userId);
    // return this.players.find((u: Player) => this.currPosition === u.type);
    return this.players.find((u: Player) => this.currIndex === u.position);
  }

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
  private currPosition: string = "";
  private currIndex: number = 0;
  private positionDict9Max: { [key: number]: string } = {
    1: "UTG",
    2: "UTG+1",
    3: "MP",
    4: "LJ",
    5: "HJ",
    6: "CO",
    7: "BTN",
    8: "SB",
    9: "BB",
  };
  private preflopActionOrder9Max: { [key: number]: string } = {
    1: "UTG",
    2: "UTG+1",
    3: "MP",
    4: "LJ",
    5: "HJ",
    6: "CO",
    7: "BTN",
    8: "SB",
    9: "BB",
  };
  private postflopActionOrder9Max: { [key: string]: number } = {
    "SB": 1,
    "BB": 2,
    "UTG": 3,
    "UTG+1": 4,
    "MP": 5,
    "LJ": 6,
    "HJ": 7,
    "CO": 8,
    "BTN": 9,
  };
  private positionDict6Max: { [key: number]: string } = {
    1: "EP",
    2: "MP",
    3: "CO",
    4: "BTN",
    5: "SB",
    6: "BB",
  };
  private preflopActionOrder6Max: { [key: number]: string } = {
    1: "EP",
    2: "MP",
    3: "CO",
    4: "BTN",
    5: "SB",
    6: "BB",
  };
  private postflopActionOrder6Max: { [key: string]: number } = {
    SB: 1,
    BB: 2,
    UTG: 3,
    MP: 4,
    CO: 5,
    BTN: 6,
  };

  private joinMsg = "";
  private handCard = [];
  private showBuyIn = false;
  private showSetting = false;
  // private sitLink: any = '';
  private sitLink: any = "";
  private gaming = false;
  private sitList: ISit[] = [];
  private actionUserId = "";
  private showAllin = false;
  private showMsg = false;
  // private playIncome = false;
  private msg = "";
  private time = ACTION_TIME;
  private timeSt: number = 0;
  private commandRecordList = [];
  private actionEndTime = 0;
  private showCommandRecord = false;
  private gameList: IGameRecord[] = [];
  private currGameIndex = 0;
  private roomConfig: IRoom = {
    isShort: false,
    smallBlind: 1,
  };
  private messageList: any[] = [];
  private showRecord = false;
  private handInfo: string[] = [];
  // 牌局设置
  private moneyType: string = "$";
  private playerNum: number = 9;
  private smallBlind: number = 1;
  private stackSize: number = 100;
  // 显示设置
  private displayByBigBlind: boolean = false;
  private displayMoneyType: string = "$";
  private displayPot: number = 0;
  //
  private isPreflop: boolean = true;
  private isPostflop: boolean = false;
  private board = [];
  private isRoundComplete: boolean = false;
  // private playerLink: Link<Player> = new Link<Player>(this.players);
  private playerLink?: Link<Player>;
  private poker: IPoker = new Poker();
  private prevPot: number = 0;
  private currActionAllinPlayer: Player[] = [];
  private slidePots: number[] = [];
  private prevSize: number = 0;
  // public currPlayer: ILinkNode<Player>;
  private allInPlayers: Player[] = [];
  private playerSize: number = 0;
  private pot: number = 0;
  private status: EGameStatus = EGameStatus.GAME_READY;
  private GameStatus: string = "PREFLOP";
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
  private inPotPlayers: Player[] = [];
  private Hero: any = "";
  private SummarySeatInfo: string[] = [];
  private RaiseNum: number = this.smallBlind * 2;
  private haveShowedHandCard: boolean = false;
  // 自动下载手牌的txt
  private autoLog: boolean = true;
  private autoDownload: boolean = false;
  private autoRefresh: boolean = true;
  //
  private HandFinished: boolean = false;
  private setHero: boolean = false;
  private showInputFlop: boolean = false;
  private showInputTurn: boolean = false;
  private showInputRiver: boolean = false;
  private haveSetRiverFlagInfo: boolean = false;
  private isAllinBoardComplete: boolean = false;
  private rawPot: number = 0;
  // private FlopBeenSet: boolean = false;
  // private TurnBeenSet: boolean = false;
  // private RiverBeenSet: boolean = false;

  public getWinner() {
    if (this.currPlayerNode) {
      // only one winner, other players fold
      if (
        (this.allInPlayers.length === 0 && this.playerSize === 1) ||
        (this.allInPlayers.length === 1 && this.playerSize === 0)
      ) {
        console.log("only one player");
        this.gameOverType = EGameOverType.GAME_OVER;
        const winner = this.allInPlayers[0] || this.currPlayerNode.node;
        this.status = EGameStatus.GAME_OVER;
        this.winner.push([winner]);
        // console.log('winner', winner);
        const uncalledBetInfo = `Uncalled bet (${this.moneyType}${this.RaiseNum}) returned to ${winner.nickName}\n`;
        // console.log('RaiseNum', this.RaiseNum);
        this.pot = this.pot - this.RaiseNum;
        // console.log('POT', this.pot);
        this.handInfo.push(uncalledBetInfo);
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
      // console.log(this.playerSize);
      // console.log(this.allPlayer);
      if (this.playerSize > 1) {
        // 找出最大牌型
        let maxPokerStyle = this.allPlayer[0].pokerStyle;
        for (let i = 0; i < this.playerNum; i++) {
          if (
            this.allPlayer[i].status === -1 ||
            this.allPlayer[i].actionCommand === "fold"
          ) {
            continue;
          } else {
            if (this.allPlayer[i].pokerStyle >= maxPokerStyle) {
              maxPokerStyle = this.allPlayer[i].pokerStyle;
            }
          }
        }
        // 找出牌力等于最大牌型的玩家，加入winner
        for (let i = 0; i < this.playerNum; i++) {
          if (
            this.allPlayer[i].status === -1 ||
            this.allPlayer[i].actionCommand === "fold"
          ) {
            continue;
          } else {
            if (this.allPlayer[i].pokerStyle >= maxPokerStyle) {
              this.winner.push([this.allPlayer[i]]);
            }
          }
        }
        return;
      }
      // 全都allin了
      if (this.playerSize === 0 && this.allInPlayers.length >= 2) {
        // console.log('TODO!');
        // console.log(this.allInPlayers);
        // 找出最大牌型
        let maxPokerStyle = this.allInPlayers[0].pokerStyle;
        for (const player of this.allInPlayers) {
          if (player.pokerStyle >= maxPokerStyle) {
            maxPokerStyle = player.pokerStyle;
          }
        }
        // 找出牌力等于最大牌型的玩家，加入winner
        for (const player of this.allInPlayers) {
          if (player.pokerStyle >= maxPokerStyle) {
            this.winner.push([player]);
          }
        }
        return;
      }
    }
  }

  private returnHome() {
    console.log("返回主页");
    this.$router.push({ name: "home" });
  }

  private switchDisplayMode() {
    this.displayByBigBlind = !this.displayByBigBlind;
    // console.log('displayByBigBlind:', this.displayByBigBlind);
    if (this.displayByBigBlind) {
      this.displayMoneyType = "bb";
      this.displayPot = this.pot / (this.smallBlind * 2);
    } else {
      this.displayMoneyType = this.moneyType;
      this.displayPot = this.pot;
    }
  }

  private getPostFlopFirstActionPlayer(leftPlayers: Player[]): Player {
    let min = this.postflopActionOrder9Max[leftPlayers[0].type];
    let firstPlayer = leftPlayers[0];
    // 循环找到firstPlayer
    for (const player of leftPlayers) {
      const val = this.postflopActionOrder9Max[player.type];
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
        player = this.allPlayer.filter(
          (p) => p.counter > 0 && p.actionCommand !== "fold"
        )[0];
      } else {
        // console.log('qqq');
        const leftPlayers = this.allPlayer.filter(
          (p) => p.counter > 0 && p.actionCommand !== "fold"
        );
        // console.log(leftPlayers);
        if (leftPlayers.length > 0) {
          player = this.getPostFlopFirstActionPlayer(leftPlayers);
        } else {
          // 全都allin了
          this.currIndex = -1;
          this.setCurrPlayerAction();
          return this.playerLink.link;
        }
      }
      this.currIndex = player.position;
      this.setCurrPlayerAction();
      let link: ILinkNode<Player> | null = this.playerLink.link;
      for (let i = 0; i < this.playerSize; i++) {
        if (link?.node.nickName === player?.nickName) {
          // console.log('getFirstActionPlayerLink', link);
          return link;
        }
        link = link?.next as ILinkNode<Player>;
      }
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

  private getInPotPlayers() {
    if (this.playerLink) {
      let sitHead = this.sitLink;
      for (let i = 0; i < this.playerNum; i++) {
        if (
          sitHead.node.player.status !== -1 &&
          sitHead.node.player.actionCommand !== "fold"
        ) {
          this.inPotPlayers.push(sitHead.node.player);
        }
        sitHead = sitHead.next;
      }
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

  private async getFlop(flop: string[]) {
    this.showInputFlop = false;
    for (const card of flop) {
      this.commonCard.push(card);
    }
  }

  private async getTurn(turn: string) {
    this.showInputTurn = false;
    this.commonCard.push(turn);
  }

  private async getRiver(river: string) {
    this.showInputRiver = false;
    this.commonCard.push(river);
  }

  @Watch("showInputFlop")
  private showInputFlopChange(oldVal: boolean, newVal: boolean) {
    if (!oldVal && newVal) {
      const flopInfoFlag = `*** FLOP *** [${this.decodeHandCard(
        this.commonCard[0]
      )} ${this.decodeHandCard(this.commonCard[1])} ${this.decodeHandCard(
        this.commonCard[2]
      )}]\n`;
      this.handInfo.push(flopInfoFlag);
    }
  }

  @Watch("isAllinBoardComplete")
  private AllinComplete(newVal: boolean, oldVal: boolean) {
    this.status = EGameStatus.GAME_SHOWDOWN;
    if (oldVal === false && newVal === true) {
      setTimeout(() => {
        this.pokerGameOver();
      }, 300);
    }
  }

  @Watch("pot")
  private potChange() {
    if (this.displayByBigBlind) {
      this.displayMoneyType = "bb";
      this.displayPot = this.pot / (this.smallBlind * 2);
    } else {
      this.displayMoneyType = this.moneyType;
      this.displayPot = this.pot;
    }
  }

  @Watch("commonCard.length")
  private commonCardChange(newVal: number, oldVal: number) {
    // 只在全部allin的时候生效
    if (this.playerSize === 0) {
      if (oldVal === 0 && newVal === 3) {
        this.setTurn();
      } else if (oldVal === 3 && newVal === 4) {
        this.setRiver();
      } else if (oldVal === 4 && newVal === 5) {
        // this.pokerGameOver();
      }
    }
  }

  @Watch("playerSize")
  private playSizeChange(newVal: number, oldVal: number) {
    // allin show牌
    if (oldVal === 1 && newVal === 0) {
      for (const player of this.allInPlayers) {
        if (player.handCard && player.handCard.length === 2) {
          const showHandInfo = `${
            player.nickName
          }: shows [${this.decodeHandCard(
            player.handCard[0]
          )} ${this.decodeHandCard(player.handCard[1])}]\n`;
          this.handInfo.push(showHandInfo);
        }
      }
    }
  }

  @Watch("showInputTurn")
  private showInputTurnChange(oldVal: boolean, newVal: boolean) {
    if (!oldVal && newVal) {
      const turnInfoFlag = `*** TURN *** [${this.decodeHandCard(
        this.commonCard[0]
      )} ${this.decodeHandCard(this.commonCard[1])} ${this.decodeHandCard(
        this.commonCard[2]
      )}] [${this.decodeHandCard(this.commonCard[3])}]\n`;
      this.handInfo.push(turnInfoFlag);
      console.log(turnInfoFlag);
    }
  }

  @Watch("showInputRiver")
  private showInputRiverChange(oldVal: boolean, newVal: boolean) {
    if (!oldVal && newVal) {
      const riverInfoFlag = `*** RIVER *** [${this.decodeHandCard(
        this.commonCard[0]
      )} ${this.decodeHandCard(this.commonCard[1])} ${this.decodeHandCard(
        this.commonCard[2]
      )} ${this.decodeHandCard(this.commonCard[3])}] [${this.decodeHandCard(
        this.commonCard[4]
      )}]\n`;
      this.handInfo.push(riverInfoFlag);
      if (this.playerSize === 0) {
        this.isAllinBoardComplete = true;
      }
    }
  }

  @Watch("actionRoundComplete")
  private actionRoundCompleteChange() {
    this.actionUserIdChange();
    this.actionRoundComplete = false;
  }

  @Watch("actionUserId")
  private actionUserIdChange() {
    // 监听player信息的变化，同步到sit，从而实时显示画面
    let sitHead = this.sitLink;
    let playerHead = this.playerLink?.link;
    // 这里默认了sitLink和playerLink长度一致，都等于this.playerNum
    for (let i = 0; i < this.playerNum; i++) {
      if (sitHead && playerHead && playerHead.next) {
        // sitHead永远是在UTG，因此在循环里，先判断sitHead对应的playerNode有没有被删除
        const sitHeadPostion = sitHead.node.player.type;
        // 如果被删除了
        if (this.isRemovedPlayer(sitHeadPostion)) {
          const removedPlayer = this.getRemovedPlayerByPosition(sitHeadPostion);
          sitHead.node.player.counter = removedPlayer?.counter;
          sitHead.node.player.actionSize = removedPlayer?.actionSize;
          sitHead.node.player.actionCommand = removedPlayer?.actionCommand;
          sitHead.node.player.status = removedPlayer?.status;
          sitHead = sitHead.next;
        } else {
          // 没被删除
          // 如果UTG call, UTG+1 fold
          // 此时sitHead在UTG，而PlayerHead在MP
          // 也就是说此处没有确保sitHead和playerHead同步
          for (let index = 0; index < this.playerSize; index++) {
            if (playerHead) {
              // sitHead和playerHead同步
              if (sitHead.node.player.type === playerHead.node.type) {
                sitHead.node.player.counter = playerHead.node.counter;
                sitHead.node.player.actionSize = playerHead.node.actionSize;
                sitHead.node.player.actionCommand =
                  playerHead.node.actionCommand;
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
    const gameConfig =
      cookie.get("gameConfig") || localStorage.getItem("gameConfig") || "";
    this.gameConfig = JSON.parse(gameConfig);
    // 牌局设置
    this.playerNum = this.gameConfig.playerNum;
    this.smallBlind = this.gameConfig.smallBlind;
    this.moneyType = this.gameConfig.moneyType;
    this.stackSize = this.gameConfig.stackSize;
    // 显示设置
    this.displayMoneyType = this.gameConfig.moneyType;
    this.displayByBigBlind = false;
    this.displayPot = this.pot;
    //
    console.log("牌局设置");
    console.log(this.gameConfig);
    // 初始化座位
    this.initSitLink(); // 为每个座位玩家进行相应设置，并得到this.sitLink
    if (this.gameConfig.playerNum === 6) {
      this.removeUselessSeats(); // 移除三个位置
    }
    this.joinMsg = "";
    this.handCard = [];
    this.commonCard = [];
    this.pot = 0;
    this.prevSize = 0;
    this.time = ACTION_TIME;
    this.winner = [];
    this.showBuyIn = false;
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
  }

  private PokeStyle(cards: string[]) {
    if (this.commonCard.length === 0 || !cards) {
      return "";
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
    // 通过index修改currPlayer
    if (this.currPlayerNode) {
      this.currIndex = this.currPlayerNode.node.position;
    }
  }

  private action(commandString: string) {
    if (this.currPlayerNode) {
      if (this.status === EGameStatus.GAME_ACTION && this.currPlayerNode.next) {
        const commands = commandString.split(":");
        const command = commands[0];
        // console.log('commands', commands);
        let size = Number(commands[1]);
        if (size !== size) {
          size = 0;
        }
        if (command === ECommand.ALL_IN) {
          const prevActionSize =
            this.currPlayerNode.node.actionSize >= 0
              ? this.currPlayerNode.node.actionSize
              : 0;
          size = this.currPlayerNode.node.counter + prevActionSize;
          // this.RaiseNum = size - prevActionSize - this.prevSize;
          if (this.prevSize !== -1) {
            this.RaiseNum = size - this.prevSize;
          } else {
            this.RaiseNum = size;
          }
          this.currActionAllinPlayer.push(this.currPlayerNode.node);
          let raiseInfo;
          // console.log('inpot', this.currPlayerNode.node.inPot);
          this.removePlayer(this.currPlayerNode.node);
          if (this.prevSize === 0 || this.prevSize === -1) {
            raiseInfo = `${this.currPlayerNode.node.nickName}: bets ${this.moneyType}${size} and is all-in\n`;
            this.pot += size - prevActionSize;
          } else {
            if (this.currPlayerNode.node.counter > this.prevSize) {
              // allin 但是筹码上个人多，比如上个人allin100，但是我all了150
              raiseInfo = `${this.currPlayerNode.node.nickName}: raises ${
                this.moneyType
              }${size - this.prevSize} to ${
                this.moneyType
              }${size} and is all in\n`;
              // this.pot += size - this.prevSize + prevActionSize;
              this.pot += size - prevActionSize;
            } else {
              // allin 但是筹码小于等于上个人的allin Size
              raiseInfo = `${this.currPlayerNode.node.nickName}: calls ${
                this.moneyType
              }${size - prevActionSize}\n`;
              this.pot += size - prevActionSize;
            }
          }
          this.handInfo.push(raiseInfo);
          console.log(raiseInfo);
        }
        if (command === ECommand.CALL) {
          // size，下注量
          size = this.prevSize;
          const actionSize =
            this.currPlayerNode.node.actionSize >= 0
              ? this.currPlayerNode.node.actionSize
              : 0;
          if (this.currPlayer) {
            this.currPlayer.actionSize = size;
            this.currPlayer.counter -= size - actionSize;
          }
          this.pot += size - actionSize;
          const callInfo = `${this.currPlayerNode.node.nickName}: calls ${
            this.moneyType
          }${size - actionSize}\n`;
          this.handInfo.push(callInfo);
        }
        if (command === ECommand.FOLD) {
          this.currPlayerNode.node.actionCommand = "fold";
          this.currPlayerNode.node.status = -1;
          this.currPlayerNode.node.actionSize = 0;
          this.removePlayer(this.currPlayerNode.node);
          const foldInfo = `${this.currPlayerNode.node.nickName}: folds\n`;
          this.handInfo.push(foldInfo);
          // 最后的Summary
          let summarySeatInfo = "";
          switch (this.GameStatus) {
            case "PREFLOP":
              if (this.currPlayerNode.node.inPot <= 0) {
                if (this.currPlayerNode.node.type === "BTN") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (button) folded before Flop (didn't bet)\n`;
                } else {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } folded before Flop (didn't bet)\n`;
                }
              } else {
                if (this.currPlayerNode.node.type === "BTN") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (button) folded before Flop\n`;
                } else if (this.currPlayerNode.node.type === "SB") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (small blind) folded before Flop\n`;
                } else if (this.currPlayerNode.node.type === "BB") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (big blind) folded before Flop\n`;
                } else {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } folded before Flop\n`;
                }
              }
              break;
            case "FLOP":
              if (this.currPlayerNode.node.inPot <= 0) {
                if (this.currPlayerNode.node.type === "BTN") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (button) folded on the Flop (didn't bet)\n`;
                } else {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } folded on the Flop (didn't bet)\n`;
                }
              } else {
                if (this.currPlayerNode.node.type === "BTN") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (button) folded on the Flop\n`;
                } else if (this.currPlayerNode.node.type === "SB") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (small blind) folded on the Flop\n`;
                } else if (this.currPlayerNode.node.type === "BB") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (big blind) folded on the Flop\n`;
                } else {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } folded on the Flop\n`;
                }
              }
              break;
            case "TURN":
              if (this.currPlayerNode.node.inPot <= 0) {
                if (this.currPlayerNode.node.type === "BTN") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (button) folded on the Turn (didn't bet)\n`;
                } else {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } folded on the Turn (didn't bet)\n`;
                }
              } else {
                if (this.currPlayerNode.node.type === "BTN") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (button) folded on the Turn\n`;
                } else if (this.currPlayerNode.node.type === "SB") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (small blind) folded on the Turn\n`;
                } else if (this.currPlayerNode.node.type === "BB") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (big blind) folded on the Turn\n`;
                } else {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } folded on the Turn\n`;
                }
              }
              break;
            case "RIVER":
              if (this.currPlayerNode.node.inPot <= 0) {
                if (this.currPlayerNode.node.type === "BTN") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (button) folded on the River (didn't bet)\n`;
                } else {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } folded on the River (didn't bet)\n`;
                }
              } else {
                if (this.currPlayerNode.node.type === "BTN") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (button) folded on the River\n`;
                } else if (this.currPlayerNode.node.type === "SB") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (small blind) folded on the River\n`;
                } else if (this.currPlayerNode.node.type === "BB") {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } (big blind) folded on the River\n`;
                } else {
                  summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
                    1}: ${
                    this.currPlayerNode.node.nickName
                  } folded on the River\n`;
                }
              }
              break;
          }
          this.SummarySeatInfo.push(summarySeatInfo);
        }
        if (command === ECommand.CHECK) {
          // prev player must be check
          if (
            !(
              this.prevSize <= 0 ||
              ((this.currPlayerNode.node.type === EPlayerType.BIG_BLIND ||
                (this.playerSize === 2 &&
                  this.currPlayerNode.node.type === EPlayerType.DEALER)) &&
                this.prevSize === this.smallBlind * 2)
            )
          ) {
            throw new Error("incorrect action: check");
          }
          // this.currPlayerNode.node.actionSize = 0;
          const checkInfo = `${this.currPlayerNode.node.nickName}: checks\n`;
          this.handInfo.push(checkInfo);
          size = -1;
        }
        if (command === ECommand.RAISE) {
          // counter not enough raise
          if (size < this.prevSize * 2) {
            throw new Error(
              `incorrect action: raise ========= action size: ${this.currPlayerNode.node.actionSize}, prevSize: ${this.prevSize}`
            );
          }
          // prevActionSize表示当前玩家已经投入的筹码
          const prevActionSize =
            this.currPlayerNode.node.actionSize >= 0
              ? this.currPlayerNode.node.actionSize
              : 0;
          if (this.currPlayer) {
            this.currPlayer.actionSize = size;
            this.currPlayer.counter -= size - prevActionSize;
          }
          this.pot += size - prevActionSize;
          // this.RaiseNum = size - prevActionSize - this.prevSize;
          if (this.prevSize !== -1) {
            this.RaiseNum = size - this.prevSize;
          } else {
            this.RaiseNum = size;
          }
          let raiseInfo;
          if (this.prevSize === 0 || this.prevSize === -1) {
            raiseInfo = `${this.currPlayerNode.node.nickName}: bets ${
              this.moneyType
            }${size - prevActionSize}\n`;
          } else {
            raiseInfo = `${this.currPlayerNode.node.nickName}: raises ${
              this.moneyType
            }${size - this.prevSize} to ${this.moneyType}${size}\n`;
          }
          this.handInfo.push(raiseInfo);
        }
        try {
          this.currPlayerNode.node.action(commandString, this.prevSize);
          const nextPlayer = this.currPlayerNode.next.node;
          if (this.isActionComplete(command, nextPlayer, size)) {
            this.actionComplete();
            return;
          }
          this.prevSize = command === ECommand.FOLD ? this.prevSize : size;
          this.nextPlayer();
          this.setCurrPlayerAction();
        } catch (e) {
          throw new Error("action:" + e);
        }
      } else {
        throw new Error("incorrect action flow");
      }
    }
  }

  private sortSummarySeatInfo() {
    console.log("sortSummarySeatInfo");
    if (this.SummarySeatInfo.length === 0) {
      return;
    } else {
      this.SummarySeatInfo.sort();
    }
  }

  private isActionComplete(command: any, nextPlayer: Player, size: number) {
    if (this.currPlayerNode) {
      if (this.playerSize === 0) {
        return true;
      }
      // left 1 player and not one allin player
      // left 1 player and current player allin, current counter small than prev player action size
      // left 1 player and has allin player, current player action size big than allin player action size
      if (
        this.playerSize === 1 &&
        (this.currActionAllinPlayer.length === 0 ||
          (command === ECommand.ALL_IN &&
            this.prevSize <= nextPlayer.actionSize &&
            this.currPlayerNode.node.actionSize < this.prevSize) ||
          (command !== ECommand.ALL_IN &&
            this.currPlayerNode.node.actionSize >= this.prevSize))
      ) {
        return true;
      }
      if (
        this.commonCard.length !== 0 &&
        nextPlayer.actionSize === this.smallBlind * 2 &&
        nextPlayer.actionSize === size &&
        size === this.prevSize
      ) {
        return true;
      }
      if (
        nextPlayer.actionSize === this.prevSize &&
        (this.prevSize === this.currPlayerNode.node.actionSize ||
          command === ECommand.FOLD) &&
        this.prevSize !== this.smallBlind * 2 &&
        this.prevSize !== 0
      ) {
        return true;
      }
      if (
        this.commonCard.length === 0 &&
        nextPlayer.actionSize === this.smallBlind * 2 &&
        this.prevSize === nextPlayer.actionSize &&
        (this.currPlayerNode.node.type === EPlayerType.BIG_BLIND ||
          (this.allPlayer.length === 2 &&
            this.currPlayerNode.node.type === EPlayerType.DEALER)) &&
        (command === ECommand.CHECK || command === ECommand.FOLD)
      ) {
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
        // console.log('evPot--------------------', this.prevPot, currAllinPlayerPot);
        allinPlayer.evPot = this.prevPot + currAllinPlayerPot;
        currAllinPlayerPot = 0;
      });
      this.allInPlayers = [...this.allInPlayers, ...this.currActionAllinPlayer];
      this.allInPlayers.sort((prev, next) => prev.evPot - next.evPot);
      // console.log('currActionAllinPlayer--------------------', this.allInPlayers, this.currActionAllinPlayer);
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
    // 如果全部allin，this.playerSize=0，直接pokerGameOver，就跳过了发牌
    if (this.playerSize === 0 && this.allInPlayers.length >= 2) {
      if (this.status === EGameStatus.GAME_FLOP) {
        // TODO!发5张flop+turn+river
        this.setFlop();
      } else if (this.status === EGameStatus.GAME_TURN) {
        // TODO!发2张turn + river
        this.setTurn();
      } else if (this.status === EGameStatus.GAME_RIVER) {
        // TODO!发1张river
        this.setRiver();
      }
    }
    // 河牌shoudown或者只剩一名玩家时，结束游戏
    if (this.status === EGameStatus.GAME_SHOWDOWN || this.playerSize === 1) {
      setTimeout(() => {
        this.pokerGameOver();
      }, 300);
    }
    // 一个玩家allin，其余玩家弃牌
    if (this.playerSize === 0 && this.allInPlayers.length === 1) {
      setTimeout(() => {
        this.pokerGameOver();
      }, 300);
    }
    // action round complete, start auto action interval
    if (this.status < EGameStatus.GAME_SHOWDOWN && this.playerSize > 1) {
      // this.actionEndTime = Date.now() + ACTION_TIME;
      this.sendCard();
      // this.startActionRound();
      this.setCurrPlayerAction();
    }
    // this.actionRoundComplete();
    this.actionRoundComplete = true;
  }

  private counting() {
    // 强行chop
    this.rawPot = this.pot;
    const winnerNum = this.winner.length;
    if (winnerNum > 1) {
      this.pot = this.pot / winnerNum;
    }
    let prevEvPot = 0;
    this.winner.forEach((winnerList, key) => {
      winnerList.sort((prev, next) => prev.inPot - next.inPot);
      let roundPotCount = 0;
      winnerList.forEach((winner, index) => {
        const pot = this.pot;
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
        console.log(
          "winner----------",
          winnerList,
          roundPotCount,
          pot,
          leftPot
        );
        if (!this.haveShowedHandCard) {
          if (this.playerSize > 1) {
            if (this.currPlayerNode) {
              let playerHead = this.currPlayerNode;
              let inPotPlayerHandInfo = "";
              for (let i = 0; i < this.playerSize; i++) {
                inPotPlayerHandInfo = `${
                  playerHead.node.nickName
                }: shows [${this.decodeHandCard(
                  playerHead.node.handCard[0]
                )} ${this.decodeHandCard(
                  playerHead.node.handCard[1]
                )}] (${this.PokeStyle(playerHead.node.handCard)})\n`;
                this.handInfo.push(inPotPlayerHandInfo);
                if (playerHead.next) {
                  playerHead = playerHead.next;
                }
              }
            }
          }
          this.haveShowedHandCard = true;
        }
        let winnerInfo = "";
        switch (winnerList[0].type) {
          case "BTN":
            winnerInfo = `${winnerList[0].nickName} (button) collected ${this.moneyType}${pot} from pot\n`;
            break;
          case "SB":
            winnerInfo = `${winnerList[0].nickName} (small blind) collected ${this.moneyType}${pot} from pot\n`;
            break;
          case "BB":
            winnerInfo = `${winnerList[0].nickName} (big blind) collected ${this.moneyType}${pot} from pot\n`;
            break;
          default:
            winnerInfo = `${winnerList[0].nickName} collected ${this.moneyType}${pot} from pot\n`;
            break;
        }
        // winnerInfo = `${winnerList[0].nickName} collected ${this.moneyType}${pot} from pot\n`;
        this.handInfo.push(winnerInfo);
      });
    });
  }

  private pokerGameOver() {
    console.log("game over------------------");
    // 清除下注UI
    this.currIndex = -1;
    this.setCurrPlayerAction();
    // only one player,other fold
    this.getWinner();
    // todo counting
    this.counting();
    console.log("before summary");
    this.Summary();
    console.log("before logHandInfo");
    this.logHandInfo();
    if (this.autoRefresh) {
      setTimeout(() => {
        location.reload();
      }, 3000);
    }
  }

  private newHand() {
    if (this.HandFinished) {
      this.HandFinished = false;
      this.gaming = false;
      this.init();
    }
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
      this.setFlop();
      this.setSate();
      // ALLIN show handcard
      if (!this.haveShowedHandCard) {
        if (this.allInPlayers.length >= 2) {
          let AllinPlayerHandInfo = "";
          for (const player of this.allInPlayers) {
            AllinPlayerHandInfo = `${
              player.nickName
            }: shows [${this.decodeHandCard(
              player.handCard[0]
            )} ${this.decodeHandCard(player.handCard[1])}]\n`;
            this.handInfo.push(AllinPlayerHandInfo);
          }
          this.haveShowedHandCard = true;
        }
      }
      // FLOP
      return;
    }
    if (this.status === EGameStatus.GAME_TURN) {
      this.setTurn();
      this.setSate();
      // ALLIN show handcard
      if (!this.haveShowedHandCard) {
        if (this.allInPlayers.length >= 2) {
          let AllinPlayerHandInfo = "";
          for (const player of this.allInPlayers) {
            AllinPlayerHandInfo = `${
              player.nickName
            }: shows [${this.decodeHandCard(
              player.handCard[0]
            )} ${this.decodeHandCard(player.handCard[1])}]\n`;
            this.handInfo.push(AllinPlayerHandInfo);
          }
          this.haveShowedHandCard = true;
        }
      }
      // TURN
      return;
    }
    if (this.status === EGameStatus.GAME_RIVER) {
      this.setRiver();
      this.setSate();
      // ALLIN show handcard
      if (!this.haveShowedHandCard) {
        if (this.allInPlayers.length >= 2) {
          let AllinPlayerHandInfo = "";
          for (const player of this.allInPlayers) {
            AllinPlayerHandInfo = `${
              player.nickName
            }: shows [${this.decodeHandCard(
              player.handCard[0]
            )} ${this.decodeHandCard(player.handCard[1])}]\n`;
            this.handInfo.push(AllinPlayerHandInfo);
          }
          this.haveShowedHandCard = true;
        }
      }
      // RIVER
      return;
    }
    throw new Error("error flow sendCard");
  }

  private setFlop() {
    this.showInputFlop = true;
  }
  private setTurn() {
    this.showInputTurn = true;
  }
  private setRiver() {
    this.showInputRiver = true;
  }

  private getMaxPlayers(lastPlayers: Player[]) {
    const maxPlayers: Player[] = [];
    const maxPlayer = lastPlayers.reduce((acc, cur) => {
      return this.compareCard(acc, cur) === 1 ? acc : cur;
    });
    // has many winner equal max player
    lastPlayers.forEach((p) => {
      if (this.compareCard(p, maxPlayer) === 0) {
        maxPlayers.push(p);
      }
    });
    return maxPlayers;
  }

  private getPlayerPokerStyle() {
    // test
    // this.commonCard = [ 'j4', 'k4', 'l4', 'm4', 'i4', ];
    this.allPlayer.map((p) => {
      if (p.handCard && p.handCard.length === 2) {
        p.pokerStyle = new PokerStyle(
          [...p.getHandCard(), ...this.commonCard],
          this.isShort
        ).getPokerWeight();
      }
      return p;
    });
  }

  private getLeftoverPot() {
    if (this.winner.length === 0) {
      return this.pot;
    }
    return this.pot - this.winner[this.winner.length - 1][0].evPot;
  }

  private getPlayers(type = "all", excludePlayers?: Player[]) {
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
      players = type === "all" ? [...players, ...this.allInPlayers] : players;
      return excludePlayers
        ? players.filter((p) => {
            const isNotPlayer = excludePlayers.filter(
              (excludePlayer) =>
                excludePlayer.userId === p.userId ||
                excludePlayer.evPot >= p.evPot
            );
            return isNotPlayer.length === 0;
          })
        : players;
    }
  }

  private setSate() {
    if (this.status === EGameStatus.GAME_ACTION) {
      if (this.commonCard.length === 0) {
        this.status = EGameStatus.GAME_FLOP;
        this.GameStatus = "FLOP";
      }
      if (this.commonCard.length === 3) {
        this.status = EGameStatus.GAME_TURN;
        this.GameStatus = "TURN";
      }
      if (this.commonCard.length === 4) {
        this.status = EGameStatus.GAME_RIVER;
        this.GameStatus = "RIVER";
      }
      if (this.commonCard.length === 5) {
        this.status = EGameStatus.GAME_SHOWDOWN;
        this.GameStatus = "SHOWDOWN";
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
  }

  private async buyIn(size: number) {
    if (size <= 0) {
      this.$plugin.toast("buy in size too small");
      return;
    }

    try {
      console.log("come in buyIn ==================", size);
      this.showMsg = true;
      this.msg =
        this.hasSit && this.isPlay
          ? `已补充买入 ${size},下局生效`
          : `已补充买入 ${size}`;
    } catch (e) {
      console.log(e);
    }
  }
  private standUp() {
    // player in the game
    if (this.currPlayer && this.currPlayer.status === 1) {
      this.$plugin.toast("sorry, please fold you hand!");
      return;
    }
    this.showSetting = false;
  }

  private play() {
    if (this.players.length >= 2) {
      this.gaming = true;
    } else {
      console.log("no enough player");
    }
  }

  // 移除九人桌的三个座位，变成六人桌
  private removeUselessSeats() {
    console.log("removeUselessSeats");
    console.log(this.playerLink);
    if (this.playerLink) {
      const UTGPlayerNode = this.playerLink.getNode(0);
      console.log(UTGPlayerNode);
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
        throw new Error("player Inadequate");
      }
    }
  }

  private setPlayer(users: IPlayer[]) {
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
    for (let i = 0; i < this.playerNum; i++) {
      const player = playerLinkHead.node;
      this.players.push(player);
      if (playerLinkHead.next) {
        playerLinkHead = playerLinkHead.next;
      } else {
        console.log("detect playerLinkHead.next is null");
      }
    }
  }
  // 记录
  private record() {
    // 先检查Hero手牌设置没
    this.checkHeroInfo();
    // this.setHero = true;
    if (this.setHero) {
      console.log("开始记录手牌");
      // 进入gaming的UI
      this.gaming = true;
      // 用sitLink初始化PlayerLink
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
      if (this.currPlayerNode) {
        // 通过currIndex切换currPlayer
        this.currIndex = this.currPlayerNode.node.position;
      }
      // this.sendCard();
      this.syncHandCard();
      this.setSate();
      this.setCurrPlayerAction();
      this.setPreFlopInfo();
      // playerLink没手牌信息
    }
  }

  private checkHeroInfo() {
    let sitHead = this.sitLink;
    // console.log('sitHead:', sitHead);
    let heroNum = 0;
    for (let i = 0; i < this.playerNum; i++) {
      if (sitHead.node.player.nickName === "Hero") {
        // this.setHero = true;
        heroNum++;
      }
      sitHead = sitHead.next;
    }
    if (heroNum === 0) {
      this.$message.error("请设置Hero的手牌");
    } else if (heroNum === 1) {
      this.setHero = true;
    } else if (heroNum >= 2) {
      this.$message.error("设置了多个Hero");
    }
  }

  private setPreFlopInfo() {
    const now = new Date();
    const year: string | number = now.getFullYear().toString(); // 得到年份
    let month: string | number = now.getMonth() + 1; // 得到月份
    let day: string | number = now.getDate(); // 得到日期
    let hour: string | number = now.getHours(); // 得到小时数
    let minute: string | number = now.getMinutes(); // 得到分钟数
    let second: string | number = now.getSeconds(); // 得到秒数
    if (month < 10) {
      month = "0" + month.toString();
    }
    if (day < 10) {
      day = "0" + day.toString();
    }
    if (hour < 10) {
      hour = "0" + hour.toString();
    }
    if (minute < 10) {
      minute = "0" + minute.toString();
    }
    if (second < 10) {
      second = "0" + second.toString();
    }
    const handId = this.getRandomNumber(9);
    const tableId = this.getRandomNumber(7);
    const platformInfo = `PokerStars Zoom Hand #${handId}: Hold'em No Limit  (${
      this.moneyType
    }${this.smallBlind}/${this.moneyType}${this.smallBlind *
      2}) - ${year}/${month}/${day} ${hour}:${minute}:${second}\n`;
    this.handInfo.push(platformInfo);
    const tableInfo = `Table 'RushAndCash${tableId}' ${
      this.playerNum
    }-max Seat #${this.playerNum - 2} is the button\n`;
    this.handInfo.push(tableInfo);
    let seatInfo;
    let sitHead = this.sitLink;
    for (let i = 0; i < this.playerNum; i++) {
      // this.Hero = sitHead.node.player;
      if (sitHead.node.player.nickName === "Hero") {
        this.Hero = sitHead.node.player;
      }
      seatInfo = `Seat ${sitHead.node.position + 1}: ${
        sitHead.node.player.nickName
      } (${this.moneyType}${sitHead.node.player.counter} in chips)\n`;
      this.handInfo.push(seatInfo);
      sitHead = sitHead.next;
    }
    const smallBlindInfo = `${this.SBPlayer?.nickName}: posts small blind ${this.moneyType}${this.smallBlind}\n`;
    this.handInfo.push(smallBlindInfo);
    const bigBlindInfo = `${this.BBPlayer?.nickName}: posts big blind ${
      this.moneyType
    }${this.smallBlind * 2}\n`;
    this.handInfo.push(bigBlindInfo);
    const preFlopFlag = `*** HOLE CARDS ***\n`;
    this.handInfo.push(preFlopFlag);
    if (this.Hero) {
      const heroHandCardInfo = `Dealt to Hero [${this.decodeHandCard(
        this.Hero.handCard[0]
      )} ${this.decodeHandCard(this.Hero.handCard[1])}]\n`;
      this.handInfo.push(heroHandCardInfo);
    }
  }

  private Summary() {
    const summaryFlag = `*** SUMMARY ***\n`;
    this.handInfo.push(summaryFlag);
    const potInfo = `Total pot ${this.moneyType}${this.rawPot} | Rake ${this.moneyType}0 | Jackpot ${this.moneyType}0 | Bingo ${this.moneyType}0 | Rake ${this.moneyType}0\n`;
    this.handInfo.push(potInfo);
    let boardInfo = "";
    switch (this.commonCard.length) {
      case 0:
        break;
      case 3:
        boardInfo = `Board [${this.decodeHandCard(
          this.commonCard[0]
        )} ${this.decodeHandCard(this.commonCard[1])} ${this.decodeHandCard(
          this.commonCard[2]
        )}]\n`;
        this.handInfo.push(boardInfo);
        break;
      case 4:
        boardInfo = `Board [${this.decodeHandCard(
          this.commonCard[0]
        )} ${this.decodeHandCard(this.commonCard[1])} ${this.decodeHandCard(
          this.commonCard[2]
        )} ${this.decodeHandCard(this.commonCard[3])}]\n`;
        this.handInfo.push(boardInfo);
        break;
      case 5:
        boardInfo = `Board [${this.decodeHandCard(
          this.commonCard[0]
        )} ${this.decodeHandCard(this.commonCard[1])} ${this.decodeHandCard(
          this.commonCard[2]
        )} ${this.decodeHandCard(this.commonCard[3])} ${this.decodeHandCard(
          this.commonCard[4]
        )}]\n`;
        this.handInfo.push(boardInfo);
        break;
    }
    if (this.currPlayerNode) {
      // 只剩一名玩家
      // let summarySeatInfo = '';
      if (this.playerSize === 1) {
        const summarySeatInfo = `Seat ${this.currPlayerNode.node.position +
          1}: ${this.currPlayerNode.node.nickName} collected (${
          this.moneyType
        }${this.pot})\n`;
        this.SummarySeatInfo.push(summarySeatInfo);
      } else if (this.playerSize === 0 && this.allInPlayers.length >= 2) {
        console.log("more than 2 allin");
        // console.log(this.allInPlayers);
        for (const player of this.allInPlayers) {
          let summarySeatInfo = "";
          if (this.isWinner(player)) {
            switch (player.type) {
              case "BTN":
                summarySeatInfo = `Seat ${player.position + 1}: ${
                  player.nickName
                } (button) showed [${this.decodeHandCard(
                  player.handCard[0]
                )} ${this.decodeHandCard(player.handCard[1])}] and collected (${
                  this.moneyType
                }${this.pot}) with ${this.PokeStyle(player.handCard)}\n`;
                break;
              case "SB":
                summarySeatInfo = `Seat ${player.position + 1}: ${
                  player.nickName
                } (small blind) showed [${this.decodeHandCard(
                  player.handCard[0]
                )} ${this.decodeHandCard(player.handCard[1])}] and collected (${
                  this.moneyType
                }${this.pot}) with ${this.PokeStyle(player.handCard)}\n`;
                break;
              case "BB":
                summarySeatInfo = `Seat ${player.position + 1}: ${
                  player.nickName
                } (big blind) showed [${this.decodeHandCard(
                  player.handCard[0]
                )} ${this.decodeHandCard(player.handCard[1])}] and collected (${
                  this.moneyType
                }${this.pot}) with ${this.PokeStyle(player.handCard)}\n`;
                break;
              default:
                summarySeatInfo = `Seat ${player.position + 1}: ${
                  player.nickName
                } showed [${this.decodeHandCard(
                  player.handCard[0]
                )} ${this.decodeHandCard(player.handCard[1])}] and collected (${
                  this.moneyType
                }${this.pot}) with ${this.PokeStyle(player.handCard)}\n`;
                console.log(summarySeatInfo);
                break;
            }
          } else {
            switch (player.type) {
              case "BTN":
                summarySeatInfo = `Seat ${player.position + 1}: ${
                  player.nickName
                } (button) showed [${this.decodeHandCard(
                  player.handCard[0]
                )} ${this.decodeHandCard(
                  player.handCard[1]
                )}] and lost with ${this.PokeStyle(player.handCard)}\n`;
                break;
              case "SB":
                summarySeatInfo = `Seat ${player.position + 1}: ${
                  player.nickName
                } (small blind) showed [${this.decodeHandCard(
                  player.handCard[0]
                )} ${this.decodeHandCard(
                  player.handCard[1]
                )}] and lost with ${this.PokeStyle(player.handCard)}\n`;
                break;
              case "BB":
                summarySeatInfo = `Seat ${player.position + 1}: ${
                  player.nickName
                } (big blind) showed [${this.decodeHandCard(
                  player.handCard[0]
                )} ${this.decodeHandCard(
                  player.handCard[1]
                )}] and lost with ${this.PokeStyle(player.handCard)}\n`;
                break;
              default:
                summarySeatInfo = `Seat ${player.position + 1}: ${
                  player.nickName
                } showed [${this.decodeHandCard(
                  player.handCard[0]
                )} ${this.decodeHandCard(
                  player.handCard[1]
                )}] and lost with ${this.PokeStyle(player.handCard)}\n`;
                break;
            }
          }
          this.SummarySeatInfo.push(summarySeatInfo);
        }
      } else if (this.playerSize === 0 && this.allInPlayers.length === 1) {
        let summarySeatInfo = "";
        switch (this.allInPlayers[0].type) {
          case "BTN":
            summarySeatInfo = `Seat ${this.allInPlayers[0].position + 1}: ${
              this.allInPlayers[0].nickName
            } (button) collected (${this.moneyType}${this.pot})\n`;
            break;
          case "SB":
            summarySeatInfo = `Seat ${this.allInPlayers[0].position + 1}: ${
              this.allInPlayers[0].nickName
            } (small blind) collected (${this.moneyType}${this.pot})\n`;
            break;
          case "BB":
            summarySeatInfo = `Seat ${this.allInPlayers[0].position + 1}: ${
              this.allInPlayers[0].nickName
            } (big blind) collected (${this.moneyType}${this.pot})\n`;
            break;
          default:
            summarySeatInfo = `Seat ${this.allInPlayers[0].position + 1}: ${
              this.allInPlayers[0].nickName
            } collected (${this.moneyType}${this.pot})\n`;
            break;
        }
        this.SummarySeatInfo.push(summarySeatInfo);
      } else {
        // 没有ALLIN
        console.log("多名玩家摊牌");
        if (this.currPlayerNode) {
          let head = this.currPlayerNode;
          for (let i = 0; i < this.playerSize; i++) {
            let summarySeatInfo = "";
            // chop pot
            // 当前玩家是winner
            if (this.isWinner(head.node)) {
              switch (head.node.type) {
                case "BTN":
                  summarySeatInfo = `Seat ${head.node.position + 1}: ${
                    head.node.nickName
                  } (button) showed [${this.decodeHandCard(
                    head.node.handCard[0]
                  )} ${this.decodeHandCard(
                    head.node.handCard[1]
                  )}] and collected (${this.moneyType}${
                    this.pot
                  }) with ${this.PokeStyle(head.node.handCard)}\n`;
                  break;
                case "SB":
                  summarySeatInfo = `Seat ${head.node.position + 1}: ${
                    head.node.nickName
                  } (small blind) showed [${this.decodeHandCard(
                    head.node.handCard[0]
                  )} ${this.decodeHandCard(
                    head.node.handCard[1]
                  )}] and collected (${this.moneyType}${
                    this.pot
                  }) with ${this.PokeStyle(head.node.handCard)}\n`;
                  break;
                case "BB":
                  summarySeatInfo = `Seat ${head.node.position + 1}: ${
                    head.node.nickName
                  } (big blind) showed [${this.decodeHandCard(
                    head.node.handCard[0]
                  )} ${this.decodeHandCard(
                    head.node.handCard[1]
                  )}] and collected (${this.moneyType}${
                    this.pot
                  }) with ${this.PokeStyle(head.node.handCard)}\n`;
                  break;
                default:
                  summarySeatInfo = `Seat ${head.node.position + 1}: ${
                    head.node.nickName
                  } showed [${this.decodeHandCard(
                    head.node.handCard[0]
                  )} ${this.decodeHandCard(
                    head.node.handCard[1]
                  )}] and collected (${this.moneyType}${
                    this.pot
                  }) with ${this.PokeStyle(head.node.handCard)}\n`;
                  break;
              }
            } else {
              switch (head.node.type) {
                case "BTN":
                  summarySeatInfo = `Seat ${head.node.position + 1}: ${
                    head.node.nickName
                  } (button) showed [${this.decodeHandCard(
                    head.node.handCard[0]
                  )} ${this.decodeHandCard(
                    head.node.handCard[1]
                  )}] and lost with ${this.PokeStyle(head.node.handCard)}\n`;
                  break;
                case "SB":
                  summarySeatInfo = `Seat ${head.node.position + 1}: ${
                    head.node.nickName
                  } (small blind) showed [${this.decodeHandCard(
                    head.node.handCard[0]
                  )} ${this.decodeHandCard(
                    head.node.handCard[1]
                  )}] and lost with ${this.PokeStyle(head.node.handCard)}\n`;
                  break;
                case "BB":
                  summarySeatInfo = `Seat ${head.node.position + 1}: ${
                    head.node.nickName
                  } (big blind) showed [${this.decodeHandCard(
                    head.node.handCard[0]
                  )} ${this.decodeHandCard(
                    head.node.handCard[1]
                  )}] and lost with ${this.PokeStyle(head.node.handCard)}\n`;
                  break;
                default:
                  summarySeatInfo = `Seat ${head.node.position + 1}: ${
                    head.node.nickName
                  } showed [${this.decodeHandCard(
                    head.node.handCard[0]
                  )} ${this.decodeHandCard(
                    head.node.handCard[1]
                  )}] and lost with ${this.PokeStyle(head.node.handCard)}\n`;
                  break;
              }
            }
            this.SummarySeatInfo.push(summarySeatInfo);
            if (head.next) {
              head = head.next;
            }
          }
        }
      }
    }
    console.log("WINNER:", this.winner);
    this.sortSummarySeatInfo();
    for (let i = 0; i < this.playerNum; i++) {
      this.handInfo.push(this.SummarySeatInfo[i]);
    }
  }

  private isWinner(player: Player): boolean {
    for (const winner of this.winner) {
      if (player.nickName === winner[0].nickName) {
        return true;
      }
    }
    return false;
  }

  private decodeHandCard(handCard: string): string {
    const cardDict: { [key: string]: string } = {
      a: "2",
      b: "3",
      c: "4",
      d: "5",
      e: "6",
      f: "7",
      g: "8",
      h: "9",
      i: "T",
      j: "J",
      k: "Q",
      l: "K",
      m: "A",
    };
    const colorDict: { [key: string]: string } = {
      1: "d",
      2: "c",
      3: "h",
      4: "s",
    };
    let card = "";
    if (handCard.length === 2) {
      card = cardDict[handCard[0]] + colorDict[handCard[1]];
    }
    return card;
  }

  private setCurrPlayerAction() {
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

  private getRandomNumber(length: number): string {
    const str = "123456789";
    let randomNumber = "";
    for (let i = length; i > 0; --i) {
      randomNumber += str[Math.floor(Math.random() * str.length)];
    }
    return randomNumber;
  }

  private getRandomId(length: number): string {
    const str = "0123456789abcdefghijklmnopqrstuvwxyz";
    let randomId = "";
    for (let i = 9; i > 0; --i) {
      randomId += str[Math.floor(Math.random() * str.length)];
    }
    return randomId;
  }

  private get6MaxStatus(index: number): number {
    const position9Max = this.positionDict9Max[index + 1];
    for (let i = 0; i < 6; i++) {
      if (position9Max === this.positionDict6Max[i]) {
        return 1;
      }
    }
    return -1;
  }

  private checkRoundComplete(): boolean {
    for (let i = 0; i < this.playerNum; i++) {
      // 没有弃牌
      if (this.players[i].status !== -1) {
        if (this.players[i].actionSize !== this.prevSize) {
          console.log("Round Not Complete");
          return false;
        }
      }
    }
    console.log("Round Complete");
    return true;
  }

  private blindDict(position: string): number {
    const blindDict: { [key: string]: number } = {
      "BTN": 0,
      "SB": 1,
      "BB": 2,
      "UTG": 0,
      "UTG+1": 0,
      "MP": 0,
      "LJ": 0,
      "HJ": 0,
      "CO": 0,
    };
    return blindDict[position];
  }
  private counterDict(position: number): number {
    const counterDict: { [key: number]: number } = {
      1: 2000 * this.smallBlind,
      2: 2000 * this.smallBlind,
      3: 2000 * this.smallBlind,
      4: 2000 * this.smallBlind,
      5: 2000 * this.smallBlind,
      6: 2000 * this.smallBlind,
      7: 2000 * this.smallBlind,
      8: 2000 * this.smallBlind,
      9: 2000 * this.smallBlind,
    };
    return counterDict[position];
  }
  private initSitLink() {
    // console.log(gameConfig.playerNum);
    // this.prevSize = this.smallBlind * 2;
    // 0~9的随机数
    // const heroSeed = Math.floor(Math.random() * 9);
    const heroSeed = 100;
    const sb = this.smallBlind;
    const bb = 2 * sb;
    const stackSize = this.stackSize;
    const sitListMap = this.sitList || [];
    if (sitListMap.length === 0) {
      for (let i = 0; i < 9; i++) {
        let sit;
        if (i === heroSeed) {
          sit = {
            player: {
              counter: stackSize * bb,
              nickName: "Hero",
              type: this.positionDict9Max[i + 1],
              // actionSize: this.blindDict(this.positionDict9Max[i + 1]),
              actionSize: 0,
              actionCommand: "",
              buyIn: stackSize * bb,
              status: -1,
              isSit: true,
              delayCount: 999,
            },
            position: i,
          };
        } else {
          sit = {
            player: {
              counter: stackSize * bb,
              nickName: this.getRandomId(8),
              type: this.positionDict9Max[i + 1],
              // actionSize: this.blindDict(this.positionDict9Max[i + 1]),
              actionSize: 0,
              actionCommand: "",
              buyIn: stackSize * bb,
              status: 1,
              isSit: true,
              delayCount: 999,
            },
            position: i,
          };
        }
        sitListMap.push(sit);
      }
    }
    const link = new Link<ISit>(sitListMap).link;
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
        console.log("ccc len", this.gameList.length);
      } else {
        this.currGameIndex = index;
        gameId = this.gameList[index - 1].gameId;
      }
      console.log(gameId, "ccc11");
      const { data } = await service.commandRecordList(this.roomId, gameId);
      this.commandRecordList = data.commandList;
      this.showCommandRecord = true;
      console.log(data);
    } catch (e) {
      console.log(e);
      this.$plugin.toast("can't find the room");
    }
  }

  // 生命周期created
  private created() {
    this.init();
  }

  private getCurrPostionByCurrIndex(currIndex: number) {
    this.currPosition = this.preflopActionOrder9Max[currIndex];
  }

  private downloadTxt(text: string, fileName: string) {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(text),
    );
    element.setAttribute("download", fileName);
    element.style.display = "none";
    element.click();
  }

  private logHandInfo() {
    // PokerStars Zoom Hand #198787544: Hold'em No Limit  ($0.5/$1) - 2021/10/8 16:49:0
    const now = new Date();
    const year = now.getFullYear(); // 得到年份
    const month = now.getMonth(); // 得到月份
    const day = now.getDate(); // 得到日期
    const hour = now.getHours(); // 得到小时数
    const minute = now.getMinutes(); // 得到分钟数
    const second = now.getSeconds(); // 得到秒数
    const fileName = `Hand${year}${month}${day}${hour}${minute}${second}.txt`;
    let text = "";
    //
    service
      .saveHandInfo(this.handInfo, localStorage.getItem("nickName"))
      .then((res) => {
        console.log(`记录成功:${res}`);
        // this.$message.success(`记录成功:${res}`);
      })
      .catch((e) => {
        console.log(`记录成功:${e}`);
        // this.$message.success(`记录成功:${e}`);
      });
    service
      .get_recorded_handsNum(localStorage.getItem("nickName"))
      .then((res) => {
        console.log(`已记录手牌数量:${res}`);
        this.$message.success(`已记录手牌数量:${res}`);
      })
      .catch((e) => {
        console.log(`已记录手牌数量:${e}`);
        this.$message.success(`已记录手牌数量:${e}`);
      });
    //
    console.log("nickName:", localStorage.getItem("nickName"));
    const length = this.handInfo.length;
    for (let i = 0; i < length; i++) {
      const line = this.handInfo[i];
      if (line !== "" && line !== undefined) {
        if (this.autoLog) {
          console.log(this.handInfo[i]);
        }
        text = text + this.handInfo[i];
      }
    }
    if (this.autoDownload) {
      this.downloadTxt(text, fileName);
    }
    this.HandFinished = true;
  }
}
</script>

<style lang="less" scoped>
.game-container {
  background: radial-gradient(#00bf86, #006a55);
  background-size: 100% 100%;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  .return {
    position: absolute;
    top: 0%;
    left: 0%;
  }
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
      transition: transform 0.5s;

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
  .game-record {
    position: absolute;
    right: 10px;
    top: 7px;
    font-size: 36px;
    color: #fff;
  }
}
</style>
