module.exports = ({ env }) => ({
  url: env('URL', 'http://127.0.0.1:1337')
});