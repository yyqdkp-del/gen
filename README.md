{
  "functions": {
    "public/api/*.js": {
      "runtime": "@vercel/node@3"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/public/api/$1" }
  ]
}
