# RToken Livepeer Experiment
Project testing integration of a Livepeer Delegator with RToken to enable minting of liquid assets for bonded LPT. 
 
## Run tests
To run the tests for an RToken with a LiveperAllocationStrategy:

1) Install dependencies by executing:
```
npm install
```
In each of the directories:  
- `livepeer-protocol`
- `rtoken-contracts`
- `rtoken-livepeer-tests`
- `rtoken-livepeer-tests-v4-contracts`  

Note: when installing dependencies in the `livepeer-protocol` directory, an `npm install node-gyp` may be required first.  

2) Run a local ganache instance:
```
ganache-cli
```

3) Compile the Livepeer Solidity v0.4 contracts and put them in the `rToken-livepeer-tests` build folder by executing:
```
truffle compile
```
In the `rtoken-livepeer-tests-v4-contracts` directory. 

4) In the `rtoken-livepeer-tests` directory run:  
```
truffle compile
truffle test
```
