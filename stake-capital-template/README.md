# Stake Capital Template

The Stake Capital template used to create a Stake Capital Aragon DAO.

## Local deployment

To deploy the DAO to a local `aragon devchain` requires `@aragon/cli` be installed from npm, alternatively once 
dependencies are installed preceed `aragon` and `truffle` commands with `npx`.

1) Install dependencies:
```
npm install
```

2) In a separate console run Aragon Devchain:
```
aragon devchain
```

3) In a separate console run the Aragon Client:
```
aragon start
```

4) Deploy the template with:
```
npm run deploy:rpc
```

5) Create a new Stake Capital DAO on the devchain (would ideally use the Aragon CLI but it's buggy so doesn't work for this purpose):
- Open `scripts/new-dao.js` and copy the output address from step 4 into the `STAKE_CAPITAL_TEMPLATE_ADDRESS`
- Run the script with:
```
truffle exec scripts/new-dao.js
```
- Copy the output DAO address into this URL and open it in a web browser:
```
http://localhost:3000/#/<DAO address>
```


