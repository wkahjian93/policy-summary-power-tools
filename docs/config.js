/* The REDEFINE team server (the same Google Apps Script server as REDEFINE Form Filler).
   It holds the OpenAI key; this URL is not secret. */
window.PSPT_CONFIG = {
  loginApi: 'https://redefine-login.dwz-rooms-server.workers.dev',   // REDEFINE Login: same phone + email + PIN on every app
  api: 'https://script.google.com/macros/s/AKfycbxgKbLfb5xv971y9DMYKEh_3LA-VoPp_6vhFSzR3dMD9QEUXoDA5DQFCoNj_-U0_2jY/exec',
  maxPhotosPerRead: 4
};
