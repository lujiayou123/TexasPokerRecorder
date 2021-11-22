<template>
  <div class="buy-in"
       v-show="showInputTurn">
    <!-- <div class="shadow"
         @click="closeInputTurn"></div> -->
    <div class="buy-in-body">
      <!-- <div class="input-bd">
        <div class="input-name"><span>s黑桃,h红桃,c梅花,d方片</span></div>
        <input type="string" v-model="handCard1" placeholder="请输入第一张牌，例如Ah">
        <input type="string" v-model="handCard2" placeholder="请输入第二张牌，例如Ad">
      </div> -->
      <h3>TURN设置</h3>
      <label>转牌</label>
      <div class="input-bd">
        <el-select v-model="color1" placeholder="请选花色" style="width:120px">
            <el-option
              v-for="item in colorOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value">
            </el-option>
        </el-select>
        <el-select v-model="card1" placeholder="请选牌" style="width:120px">
            <el-option
              v-for="item in cardOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value">
            </el-option>
        </el-select>
      </div>

      <div class="btn"><span @click="inputTurn">确定</span></div>
    </div>
  </div>
</template>

<script lang="ts">
  import { Component, Prop, Watch, Vue } from 'vue-property-decorator';

  @Component({
    components: {
      // range,
    },
  })
  export default class InputTurn extends Vue {
    // prop
    @Prop() private showInputTurn!: boolean;
    // @Prop() private handCard1!: string;
    // @Prop() private handCard2!: string;
    // @Prop() private handCard!: string[];
    private card1: string = '6';
    private color1: string = 'd';
    private handCard: string[] = [];
    private Turn: string = '';
    private IsHero: boolean = false;
    private cardOptions = [
        {
          value: 'A',
          label: 'A',
        },
        {
          value: 'K',
          label: 'K',
        },
        {
          value: 'Q',
          label: 'Q',
        },
        {
          value: 'J',
          label: 'J',
        },
        {
          value: 'T',
          label: 'T',
        },
        {
          value: '9',
          label: '9',
        },
        {
          value: '8',
          label: '8',
        },
        {
          value: '7',
          label: '7',
        },
        {
          value: '6',
          label: '6',
        },
        {
          value: '5',
          label: '5',
        },
        {
          value: '4',
          label: '4',
        },
        {
          value: '3',
          label: '3',
        },
        {
          value: '2',
          label: '2',
        },
      ];
    private colorOptions = [{
          value: 's',
          label: '黑桃',
        }, {
          value: 'h',
          label: '红桃',
        }, {
          value: 'c',
          label: '草花',
        },
        {
          value: 'd',
          label: '方片',
        },
        ];

    private closeInputTurn() {
      this.$emit('update:showInputTurn', false);
    }

    private async inputTurn() {
      const cardDict: { [key: string]: string; } = {
        2: 'a', 3: 'b', 4: 'c', 5: 'd', 6: 'e', 7: 'f', 8: 'g', 9: 'h', T: 'i', J: 'j', Q: 'k', K: 'l', A: 'm',
        t: 'i', j: 'j', q: 'k', k: 'l', a: 'm',
      };
      const colorDict: { [key: string]: string; } = {
        d: '1', c: '2', h: '3', s: '4',
        D: '1', C: '2', H: '3', S: '4',
      };
      let card1 = '';
      card1 = cardDict[this.card1] + colorDict[this.color1];
      this.Turn = card1;
      console.log(this.Turn);
      this.$emit('TransferTurnToRecord', this.Turn);
      this.closeInputTurn();
    }
    private mounted() {
      // this.buyInSize = this.min;
    }
  }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped
       lang="less">
  .buy-in {
    position: fixed;
    z-index: 99;

    .shadow {
      position: fixed;
      z-index: 9;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.2);
    }

    .buy-in-body {
      z-index: 99;
      position: fixed;
      left: 50%;
      top: 50%;
      margin: -100px -150px;
      width: 300px;
      border-radius: 12px;
      box-sizing: border-box;
      background: #fff;
      padding: 20px;
    }

    .input-text {
      input {
        width: 100px;
      }
    }
    .input-name{
      margin-bottom: 15px;
      font-size: 20px;
      text-align: center;
      input{
        width: 70px;
        font-size: 20px;
      }
    }
    .btn{
      margin-top: 20px;
    }
  }

</style>
