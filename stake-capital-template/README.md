# Stake Capital Template

The Stake Capital template used to create a Stake Capital Aragon DAO.

## Local deployment

To deploy the DAO to a local `aragon devchain`, requires `@aragon/cli` be installed from npm. 

1) In a separate console run Aragon Devchain:
```
aragon devchain
```

2) In a separate console run the Aragon Client:
```
aragon start
```

3) Deploy the template with:
```
npm run deploy:rpc
```

4) Create a new Stake Capital DAO on the devchain (would ideally use the Aragon CLI but it's buggy so doesn't work for this purpose):
- Open the truffle console:
```
truffle console
```
- Create a reference to the Stake Capital template:
```
let template = await StakeCapitalTemplate.at("<address output in step 3>")
```
- Create a new token and deploy the DAO. Note the DAO ID (in this case "stake-capital") must be unique, when deploying a second time this must be changed or a `revert` will occur:
```
let receipt = await template.newTokenAndInstance("Test", "TST", "stake-capital", ["0xb4124ceb3451635dacedd11767f004d8a28c6ee7"], ["1000000000000000000"], ["10000000000000000", "10000000000000000", "3000"], 0, true)
```
- Output DAO address:
```
receipt.logs.find(x => x.event === "DeployDao").args.dao
```
- Copy the output address into this URL and open in a web browser:
```
http://localhost:3000/#/<DAO address>
```


