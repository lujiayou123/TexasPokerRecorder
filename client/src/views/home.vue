<template>
  <div class="home-container container">
    <div class="room-btn"
         v-show="showBtn">
      <div class="room-config" v-show="showRoomConfig">
        <div class="room-config-shadow" @click="showRoomConfig = false"></div>
        <div class="room-config-body">
          <h1> room config</h1>
          <div class="input-bd">
            <div class="input-name">smallBlind:</div>
            <div class="input-text">
              <input type="tel"
                     v-model="smallBlind"/>
            </div>
          </div>
          <div class="input-bd">
            <div class="input-name">isShort:</div>
            <div class="input-text">
              <input type="checkbox"
                     v-model="isShort"/>
            </div>
          </div>
          <div class="btn"  @click="createRoom"><span>create</span></div>
        </div>
      </div>
     <!-- record -->
      <div class="room-config" v-show="showGameconfig">
        <div class="room-config-shadow" @click="showGameconfig = false"></div>
        <div class="room-config-body">
          <h1> 手牌设置</h1>
          <div class="input-bd">
            <div class="input-name">小盲:</div>
            <div class="input-text">
              <input type="tel"
                     v-model="smallBlind"/>
            </div>
          </div>
          <div class="input-bd">
            <div class="input-name">人数:</div>
            <div class="input-text">
              <input type="tel"
                     v-model="playerNum"/>
            </div>
          </div>
          <div class="btn"  @click="recordSingleHand"><span>记录一手牌</span></div>
        </div>
      </div>
      <!-- 创建 -->
      <div class="create-room btn"
          @click="showRoomConfig = true" ><span>create room</span>
      </div>
      <!-- 加入 -->
      <div class="btn"
           @click="joinRoom"><span>join room</span>
      </div>
      <!-- <div class="btn"
           @click="getRecord(0)"><span>test record</span>
      </div> -->
      <div class="create-room btn"
          @click="showGameconfig = true" ><span>记录一手牌</span>
      </div>
    </div>
    <div class="room-number"
         v-show="isJoin">
      <div class="room-input inline">
        <div class="input-bd"
             :class="{error: isError}">
          <div class="input-name iconfont icon-password"></div>
          <div class="input-text">
            <input type="tel"
                   maxlength="6"
                   @focus="isError = false"
                   v-model="roomNumber"/>
          </div>
        </div>
      </div>
      <div class="room-btn inline">
        <span @click="go">go</span>
      </div>
    </div>
    <gameRecord v-model="showRecord"
                :game-list="gameList"
                :curr-game-index="currGameIndex"
                @getRecord = "getRecord"
                :command-list="commandList"></gameRecord>
  </div>
</template>

<script lang="ts">
  import { Vue } from 'vue-property-decorator';
  import Component from 'vue-class-component';
  import gameRecord from '@/components/GameRecord.vue';
  import service from '../service';
  import cookie from 'js-cookie';
  import {IGameRecord} from '@/interface/IGameRecord';

  @Component({
    components: {
      gameRecord,
    },
  })
  export default class Home extends Vue {
    public roomNumber: string = '';
    private isJoin = false;
    private showBtn = true;
    private isError = false;
    private isShort = false;
    private smallBlind = 0.5;
    private showRoomConfig = false;
    // 游戏设置
    private showGameconfig = false;
    // 人数
    private playerNum = 9;
    private moneyType = '$';
    private showRecord = false;
    private commandList = [];
    private currGameIndex = 0;
    private gameList: IGameRecord [] = [];

    // 创建房间
    private async createRoom() {
      try {
        const result = await service.createRoom(this.isShort, this.smallBlind, 0);
        const { roomNumber } = result.data;
        const roomConfig = {
          isShort: this.isShort,
          smallBlind: this.smallBlind,
        };
        localStorage.setItem('roomConfig', JSON.stringify(roomConfig));
        cookie.set('roomConfig', roomConfig, {expires: 1});
        this.$router.push({ name: 'game', params: { roomNumber, isOwner: '1' } });
      } catch (e) {
        console.log(e);
      }
    }

    // 加入房间号
    private joinRoom() {
      this.isJoin = true;
      this.showBtn = false;
    }

    private async go() {
      if (!/^\d+$/.test(this.roomNumber)) {
        this.isError = true;
        return;
      }
      try {
        const { data } = await service.findRoom(this.roomNumber);
        if (data) {
          const roomConfig = {
            ...data,
          };
          cookie.set('roomConfig', roomConfig, {expires: 1});
          this.$router.push({ name: 'game', params: { roomNumber: this.roomNumber } });
        } else {
          this.$plugin.toast('can\'t find the room');
          console.log('can\'t find the room');
        }
      } catch (e) {
        this.$plugin.toast('can\'t find the room');
      }
    }

    private async getRecord(index: number) {
      try {
        console.log('getRecord');
        let gameId = 0;
        if (!index) {
          const result = await service.gameRecordList('648002');
          this.gameList = Object.values(result.data);
          gameId = this.gameList[this.gameList.length - 1].gameId;
          this.currGameIndex = this.gameList.length;
          console.log('ccc len', this.gameList.length);
        } else {
          this.currGameIndex = index;
        }
        console.log(gameId, 'ccc11');
        gameId = this.gameList[index].gameId;
        const { data } = await service.commandRecordList('648002', gameId);
        this.commandList = data.commandList;
        this.showRecord = true;
        console.log(data);
      } catch (e) {
        console.log(e);
        this.$plugin.toast('can\'t find the room');
      }
    }

    private recordSingleHand() {
      console.log('记录一手牌');
      const gameConfig = {
          smallBlind: this.smallBlind,
          playerNum: this.playerNum,
          moneyType: this.moneyType,
        };
      localStorage.setItem('gameConfig', JSON.stringify(gameConfig));
      cookie.set('gameConfig', gameConfig, {expires: 1});
      this.$router.push({ name: 'record'});
    }
  }
</script>
<style lang="less"
       scoped>
  .home-container {
    height: 100vh;
    display: flex;
    flex-direction: row;
    align-items: center;
    .room-config{
      position: absolute;
      width: 100vw;
      height: 100vh;
      top: 0;
      left: 0;
      .room-config-shadow{
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        top: 0;
        z-index: 9;
        background-color: rgba(0,0,0,.3);
      }
      .room-config-body{
        position: absolute;
        background-color: #fff;
        border-radius: 8px;
        left: 50%;
        top: 50%;
        z-index: 99;
        width: 230px;
        min-height: 200px;
        transform: translate3d(-50%, -50%, 0);
        h1{
          font-size: 16px;
          text-align: center;
          line-height: 40px;
        }
        .input-bd{
          display: flex;
          .input-name{
            width: 20vw;
            text-align: right;
          }
          .input-text{
            margin-left: 8px;
            line-height: 30px;
            input{
              width: 10vw;
              min-width: 10vw;
              display: inline-block;
              text-align: center;
              vertical-align: middle;
              border-bottom: 1px solid #bababa;
              &[type=checkbox]{
                width: 4vw;
                height: 4vw;
                min-width: auto;
                min-height: auto;
              }
            }
          }
        }
      }
    }

    .room-btn {
      flex: 1;

      .btn {
        width: 50vw;
        margin: 30px auto;
      }
    }

    .room-number {
      line-height: 40px;
      text-align: center;
      width: 100%;
      .error {
        border: 1px solid #e8050a;
      }
      .input-bd {
        border: 1px solid #bababa;
        border-radius: 4px;
        input {
          border-radius: 8px;
        }
      }
      .room-btn {
        height: 30px;
        margin-top: 0;

        span {
          margin: 0;
          line-height: 30px;
          height: 30px;
          font-size: 12px;
          color: #fff;
          background-color: #00976e;
          border-radius: 8px;
          padding: 0 20px;
          display: block;
        }
      }

      .inline {
        display: inline-block;
        vertical-align: middle;
      }
    }
  }
</style>
