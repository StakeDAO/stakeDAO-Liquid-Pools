To run the tests for an RToken with a LiveperAllocationStrategy:

Install dependencies in each of `livepeer-protocol`, `rtoken-contracts`, `rtoken-livepeer-tests` and `rtoken-livepeer-tests-v4-contracts` directories by calling this in each of them:
```
npm install
```
Note: when installing dependencies in the `livepeer-protocol` directory, an `npm install node-gyp` may be required first.  


In the `rtoken-livepeer-tests-v4-contracts` directory run (this compiles the Livepeer Solidity v0.4 contracts and puts
 them in the `rToken-livepeer-tests` build folder):  
```
truffle compile
```
In the `rtoken-livepeer-tests` directory run:  
```
truffle compile
truffle test
```
