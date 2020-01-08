# Stake Capital Template

The Stake Capital template used to create a Stake Capital Aragon DAO.

## Local deployment

To deploy the DAO to a local `aragon devchain` requires `@aragon/cli` and `truffle` be installed from npm. Alternatively once 
the project dependencies are installed preceed `aragon` and `truffle` commands with `npx`.

1) Install dependencies:
```
$ npm install
```

2) In a separate console run Aragon Devchain:
```
$ aragon devchain
```

3) In a separate console run the Aragon Client:
```
$ aragon start
```

4) Hard code the correct `TOKEN_WRAPPER_ID` in `contracts/StakeCapitalTemplate.sol`. 
   Uncomment the one specified for local deployment, comment the other one.

5) Deploy the template with:
```
$ npm run deploy:rpc
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

8) Create a new Stake Capital DAO on the devchain (for subsequent executions, the `STAKE_CAPITAL_DAO_ID` constant must 
be changed to an unused ID as it must be unique):
```
$ truffle exec scripts/new-dao.js
```

9) Copy the output DAO address into this URL and open it in a web browser:
```
http://localhost:3000/#/<DAO address>
```

## Rinkeby deployment

1) Install dependencies (if not already installed):
```
$ npm install
```

2) Deployment to Rinkeby requires adding a `rinkeby_key.json` file to the `.aragon` folder in your home directory with an infura link 
and your own private keys. Steps for adding this file can be found here: https://hack.aragon.org/docs/cli-intro#set-a-private-key.  
- An Infura link for Rinkeby can be created by creating an Infura account here: https://infura.io/  
- Private keys for MetaMask accounts can be found by opening MetaMask, clicking the hamburger menu, then `Details` under 
the account name.  
 
    The `scripts/new-dao.js` script requires there be 2 private keys in the `keys` field of the relevant config file
for testing purposes. The `rinkeby_key.json` file should look something like this:
```
{
  "rpc": "https://rinkeby.infura.io/v3/<infura-api-key>",
  "keys": [
    "<private key 1>", 
    "<private key 2>"
  ]
}
```


3) Hard code the correct `TOKEN_WRAPPER_ID` in `contracts/StakeCapitalTemplate.sol`. 
   Uncomment the one specified for rinkeby/mainnet deployment, comment the other one.

4) Deploy the template with:
```
$ npm run deploy:rinkeby
```

5) Modify any of the DAO config constants necessary in the `scripts/new-dao.js` script. 

6) Create a new Stake Capital DAO with (for subsequent executions, the `STAKE_CAPITAL_DAO_ID` constant must be changed
to an unused ID as it must be unique):
```
$ truffle exec scripts/new-dao.js --network rinkeby
```

7) Copy the output DAO address into this URL and open it in a web browser:
```
https://rinkeby.aragon.org/#/<DAO address>
```

