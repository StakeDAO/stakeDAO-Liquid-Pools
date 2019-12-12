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

4) Hard code the correct `TOKEN_WRAPPER_ID` in `contracts/StakeCapitalTemplate.sol`. 
   Uncomment the one specified for local deployment, comment the other one.

5) Deploy the template with:
```
npm run deploy:rpc
```

6) Deploy the Token-Wrapper to the devchain as it's not installed by default like the other main apps (Voting, Token Manager, Agent etc):
- Download https://github.com/aragonone/token-wrapper
- Run `npm install` in the `token-wrapper` folder
- Execute `npm run apm:publish major`

7) Deploy the Rewards app to the devchain as it's not installed by default like the other main apps (Voting, Token Manager, Agent etc):
- Download https://github.com/AutarkLabs/open-enterprise
- Run `npm install` in the `open-enterprise` folder
- Execute `npm run build` in the `open-enterprise/apps/rewards` folder
- Execute `npm run publish:major` in the `open-enterprise/apps/rewards` folder

8) Create a new Stake Capital DAO on the devchain:
```
truffle exec scripts/new-dao.js
```

9) Copy the output DAO address into this URL and open it in a web browser:
```
http://localhost:3000/#/<DAO address>
```

// TODO: Update local deployment instrs.

## Rinkeby deployment

Need to specify local keys.

1) Install dependencies (if not already installed):
```
npm install
```

2) Hard code the correct `TOKEN_WRAPPER_ID` in `contracts/StakeCapitalTemplate.sol`. 
   Uncomment the one specified for rinkeby/mainnet deployment, comment the other one.

3) Deploy the template with:
```
npm run deploy:rinkeby
```

4) Modify any of the DAO config constants is necessary in the `scripts/new-dao.js` script. 

5) Create a new Stake Capital DAO with:
```
truffle exec scripts/new-dao.js --network rinkeby
```

6) Copy the output DAO address into this URL and open it in a web browser:
```
https://rinkeby.aragon.org/#/<DAO address>
```

