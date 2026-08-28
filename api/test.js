// Zero dependency test — if this crashes, it's a Vercel config issue not our code
module.exports = function(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end('{"status":"alive"}');
};
