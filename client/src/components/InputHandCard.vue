<template>
  <div class="buy-in"
       v-show="showHandCardInput">
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
    @Prop() private showHandCardInput!: boolean;
    // @Prop() private handCard1!: string;
    // @Prop() private handCard2!: string;
    // @Prop() private handCard!: string[];
    private handCard1: string = '';
    private handCard2: string = '';
    private handCard: string[] = [];


    // private getHandCard() {
    //   console.log('handCard1', this.handCard1);
    //   console.log('handCard2', this.handCard2);
    //   this.handCard = [this.handCard1, this.handCard2];
    //   console.log('this.handCard', this.handCard);
    // }

    private closeInputHandCard() {
      this.$emit('update:showHandCardInput', false);
    }

    private async inputHandCard() {
      this.closeInputHandCard();
      // console.log('handCard1', this.handCard1);
      // console.log('handCard2', this.handCard2);
      this.handCard = [this.handCard1, this.handCard2];
      console.log('this.handCard', this.handCard);
      this.$emit('handCard', this.handCard);
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
