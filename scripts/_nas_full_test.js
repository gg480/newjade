
const http = require("http");
function request(path, method, body) {
  return new Promise((resolve, reject) => {
    const opts = {hostname:"127.0.0.1",port:5000,path:path,method:method||"GET",headers:{}};
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.headers["Content-Length"] = Buffer.byteLength(body);
    }
    const r = http.request(opts, (res) => {
      let b = "";
      res.on("data", c => b += c);
      res.on("end", () => resolve({status:res.statusCode, headers:res.headers, body:b}));
    });
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}
(async () => {
  // Login
  const lr = await request("/api/auth/login", "POST", JSON.stringify({username:"admin",password:"admin123"}));
  const token = JSON.parse(lr.body).data?.token;
  if (!token) { console.log("LOGIN_FAIL"); return; }
  console.log("TOKEN_OK");
  
  // Test local-reference
  const lr_res = await request("/api/metal-prices/local-reference", "GET", null, token);
  lr_res.headers["authorization"] = "Bearer " + token;
  // Actually, let me use the proper way
  const http2 = require("http");
  const p = new Promise((resolve) => {
    http2.get({hostname:"127.0.0.1",port:5000,path:"/api/metal-prices/local-reference",headers:{"Authorization":"Bearer "+token}},(res)=>{
      let b="";res.on("data",c=>b+=c);res.on("end",()=>resolve({s:res.statusCode, b}));
    });
  });
  const r1 = await p;
  if (r1.s === 200) {
    try {
      const d = JSON.parse(r1.b);
      if (d.data?.available) {
        d.data.items.forEach(i => console.log("LR:"+i.name+"|"+i.buyPrice+"|"+i.sellPrice));
      } else {
        console.log("LR_UNAVAIL:"+(d.data?.message||""));
      }
    } catch(e) {
      console.log("LR_PARSE_ERR:"+r1.b.substring(0,100));
    }
  } else {
    console.log("LR_HTTP_"+r1.s+":"+r1.b.substring(0,100));
  }
  
  // Test market
  const p2 = new Promise((resolve) => {
    http2.get({hostname:"127.0.0.1",port:5000,path:"/api/metal-prices/market?source=auto",headers:{"Authorization":"Bearer "+token}},(res)=>{
      let b="";res.on("data",c=>b+=c);res.on("end",()=>resolve({s:res.statusCode, b}));
    });
  });
  const r2 = await p2;
  if (r2.s === 200) {
    try {
      const d = JSON.parse(r2.b);
      if (d.code === 0 && d.data) {
        d.data.forEach(p => console.log("MK:"+p.code+"|"+p.price+"|"+p.materialName));
      } else {
        console.log("MK_ERR:"+d.message);
      }
    } catch(e) {
      console.log("MK_PARSE_ERR");
    }
  }
  console.log("DONE");
})();
