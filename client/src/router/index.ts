import Vue from 'vue';
import VueRouter, { RouteConfig } from 'vue-router';
import Home from '../views/home.vue';
import Login from '../views/login.vue';
import Register from '../views/register.vue';
import Game from '../views/game.vue';
// 记录手牌
import Record from '../views/record.vue';
import RangeTraining from '../views/rangeTraining.vue';
import service from '../service';
import origin from '../utils/origin';

Vue.use(VueRouter);

const routes: RouteConfig[] = [
  {
    path: '/',
    name: 'home',
    component: Home,
    meta: {
      title: 'home',
      needLogin: true,
    },
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: {
      title: 'login',
    },
  },
  {
    path: '/register',
    name: 'register',
    component: Register,
    meta: {
      title: 'create account',
    },
  },
  {
    path: '/game/:roomNumber/:isOwner?',
    name: 'game',
    component: Game,
    meta: {
      title: 'game',
      needLogin: true,
    },
  },
  // 记录手牌
  {
    path: '/record',
    name: 'record',
    component: Record,
    meta: {
      title: 'record',
      needLogin: false,
    },
  },
  // 记录手牌
  {
    path: '/rangeTraining',
    name: 'rangeTraining',
    component: RangeTraining,
    meta: {
      title: 'rangeTraining',
      needLogin: false,
    },
  },
];

const router = new VueRouter({
  routes,
});

router.beforeEach(async (to, from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title;
  }
  if (to.meta.needLogin) {
    try {
      const result = await service.checkLogin();
      console.log(result);
      localStorage.setItem('nickName', result.data.nickName);
      next();
    } catch (e) {
      await router.replace({ name: 'login' });
    }
  } else {
    next();
  }
});

export default router;
