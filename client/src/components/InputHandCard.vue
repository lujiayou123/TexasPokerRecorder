<template>
  <div class="buy-in"
       v-show="showInputHandCard">
    <div class="shadow"
         @click="closeInputHandCard"></div>
    <div class="buy-in-body">
      <div class="input-bd">
        <div class="input-name"><span>s黑桃,h红桃,c梅花,d方片</span></div>
        <input type="string" v-model="handCard1" placeholder="请输入第一张牌，例如Ah">
        <input type="string" v-model="handCard2" placeholder="请输入第二张牌，例如Ad">
      </div>
      <div class="btn"><span @click="inputHandCard">确定</span></div>
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
  export default class InputHandCard extends Vue {
    // prop
    @Prop() private showInputHandCard!: boolean;
    // @Prop() private handCard1!: string;
    // @Prop() private handCard2!: string;
    // @Prop() private handCard!: string[];
    private handCard1: string = '';
    private handCard2: string = '';
    private handCard: string[] = [];

    private closeInputHandCard() {
      this.$emit('update:showInputHandCard', false);
    }

    private async inputHandCard() {
      const cardDict: { [key: string]: string; } = {
        2: 'a', 3: 'b', 4: 'c', 5: 'd', 6: 'e', 7: 'f', 8: 'g', 9: 'h', T: 'i', J: 'j', Q: 'k', K: 'l', A: 'm',
        t: 'i', j: 'j', q: 'k', k: 'l', a: 'm',
      };
      const colorDict: { [key: string]: string; } = {
        d: '1', c: '2', h: '3', s: '4',
        D: '1', C: '2', H: '3', S: '4',
      };
      let card1 = '';
      let card2 = '';
      if (this.handCard1.length === 2) {
        card1 = cardDict[this.handCard1[0]] + colorDict[this.handCard1[1]];
      }
      if (this.handCard2.length === 2) {
        card2 = cardDict[this.handCard2[0]] + colorDict[this.handCard2[1]];
      }
      this.handCard = [card1, card2];
      // this.$emit('child-event', 传递内容);
      this.$emit('child-event', this.handCard);
      this.closeInputHandCard();
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
