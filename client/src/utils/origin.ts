export default {
  url: process.env.NODE_ENV !== 'production' ?
    process.env.NODE_ENV === 'develop' ? 'http://172.22.72.70:7002'
      : 'http://127.0.0.1:7002' : 'http://www.jojgame.com:7002',
  res: location.href.split('#')[0] + '#',
};
