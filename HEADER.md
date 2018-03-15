# monogram

Action-based anti-ODM for MongoDB and Node.js

Read the [intro blog post here](http://thecodebarbarian.com/introducing-monogram-the-anti-odm-for-mongodb-nodejs.html).

## Usage

```javascript
const { connect } = require('monogram');
const db = await connect('mongodb://localhost:27017/test');
```
