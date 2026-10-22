export default {
  base: './', // relative asset paths so the build works from any host or sub-path
  server: { host: true, port: Number(process.env.PORT) || 5173 },   // PORT lets a second checkout/chat run its own dev server
};
