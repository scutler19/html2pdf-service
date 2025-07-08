# PDF Converter

Based on [Playwright](https://github.com/microsoft/playwright), convert HTML content to PDF via API.

## API

Send GET request on `/api/convert`, like `https://myserver.com/api/convert?html=<h1>Hello</h1>`.  
Support POST request on `/api/convert` with body data.  

Server will return url where document is available, example : `https://myserver.com/public/pdf/02132102983-533083.pdf`.
Documents are deleted after 1 hour.  

### Available options

#### Mandatory options

##### `html` \<string\>
HTML template, ie: `<h1>Hello</h1>`

#### Optional options
##### `marginTop` \<string | number\>
Customize top margin for *html* content only, header/footer templates are not affected.  
Can be number : `px` or string : `px`, `in`, `cm`, `mm`

##### `marginLeft` \<string | number\>
Same as marginTop option

##### `marginRight` \<string | number\>
Same as marginTop option

##### `marginBottom` \<string | number\>
Same as marginTop option

##### `headerTemplate` \<string | number\>
HTML template, ie: `<div style="margin-left: 20px">header</div>`.  

**Be careful** :  
- Header template is not affected by content margin, so you have to specify it inside your HTML.
- Image `src` tag in header template must be a _Base64_, it can't be a `http(s)://` link  (see [issue](https://github.com/puppeteer/puppeteer/issues/2443))
- Header template is kinda "zoomed in", so you may have to lower font-sizes/widths/heights/margins/paddings values (ie: font-size: 11px -> font-size: 8px) (see [issue](https://github.com/puppeteer/puppeteer/issues/2104))

Add tag with following classes to put content inside :  
- date : formatted print date
- title : document title
- url : document location
- pageNumber : current page number
- totalPages : total pages in the document

Example :
```
<div class="date"></div>
<p><span class="pageNumber"></span>/<span class="totalPages"></span></p>
```

##### `footerTemplate` \<string\>
Same as headerTemplate option

##### `style` \<string\>
CSS rules

##### `landscape` <'true'>
Specify PDF orientation, by default it is portrait.  
You can set at landscape with `'true'` value.  

##### `width` \<string\>
Paper width, accepts values labeled with units.  
Can be number : `px` or string : `px`, `in`, `cm`, `mm`

##### `height` \<string\>
Paper height, accepts values labeled with units.  
Can be number : `px` or string : `px`, `in`, `cm`, `mm`

##### `format` \<string\>
Paper format. If set, takes priority over width or height options. Defaults to 'Letter'.  
Values : 
- `Letter` (8.5in x 11in)
- `Legal` (8.5in x 14in)
- `Tabloid` (11in x 17in)
- `Ledger` (17in x 11in)
- `A0` (33.1in x 46.8in)
- `A1` (23.4in x 33.1in)
- `A2` (16.54in x 23.4in)
- `A3` (11.7in x 16.54in)
- `A4` (8.27in x 11.7in)
- `A5` (5.83in x 8.27in)
- `A6` (4.13in x 5.83in)

##### `filename` \<string\>
Specify your own filename. PDF with same filenames will be overwritten. By default, it will be a unique generated name.

## Usage

All `/api/convert` requests require a valid API key in the `X-API-KEY` header. Invalid or missing API keys will return HTTP 401 with `{error:"invalid_api_key"}`.

## Production

### Requirements

- Docker and docker-compose must be installed

### Configuration

- Docker Environment file `.env` must be present to project's root
- Node configuration file `config.ts` must be present into `app/config` folder

### Production Features

- ✅ **Dynamic PORT configuration** for Render deployment
- ✅ **API key validation** with database lookup
- ✅ **Comprehensive error handling** and logging
- ✅ **Usage metering** and billing integration
- ✅ **Concurrency control** to prevent resource exhaustion
- ✅ **Security middleware** with CORS and Helmet
- ✅ **Health check endpoints** for monitoring
- ✅ **Automatic PDF cleanup** via cron jobs
- ✅ **Docker optimization** with Playwright base image
- ✅ **Production-ready middleware** with proper error handling
- ✅ **Database schema** with accounts and subscriptions tables

### Testing Production Readiness

Run the comprehensive test suite to verify all components:

```bash
# Test against local server
node test-production-readiness.js

# Test against deployed server
TEST_URL=https://your-app.onrender.com node test-production-readiness.js
```

### Launch

```
docker-compose down
docker-compose build
docker-compose up
```

## Development

### Requirements

- Node.js must be installed

### Configuration

- Docker Environment file `.env` must be present to project's root
- Node configuration file `config.ts` must be present into `app/config` folder

### Before launch

```
cd app
npm i
```

### Launch

```
cd app
tsc && node app.js
```
