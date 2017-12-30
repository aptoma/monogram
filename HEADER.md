# monogram

Action-based anti-ODM for MongoDB and Node.js

Read the [intro blog post here](git@github.com:boosterfuels/monogram.git).

## Usage

```javascript
const { connect } = require('monogram');
const db = await connect('mongodb://localhost:27017/test');
```
