export default {
  url: process.env.NODE_ENV !== 'production' ?
    process.env.NODE_ENV === 'develop' ? 'http://101.43.24.110:7001'
      : 'http://127.0.0.1:7001' : 'http://101.43.24.110:7001',
  res: location.href.split('#')[0] + '#',
};
