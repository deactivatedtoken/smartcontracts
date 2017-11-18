const LeapTokensalePlaceholder = artifacts.require('LeapTokensalePlaceholder');
const Tokensale = artifacts.require('LeapPrivatePreTokensaleFake');
const Token = artifacts.require('Token');
const BitcoinProxy = artifacts.require('BitcoinProxy');

const utils = require('./utils');
const expect = utils.expect;
const expectThrow = utils.expectThrow;
const ether = utils.ether;
const getBalance = utils.getBalance;
const inBaseUnits = utils.inBaseUnits;

contract("LeapPrivatePreTokensale", function([deployer, token, placeholder, proxy, wallet, investor, hacker]) {
	const hardcap = inBaseUnits(52500000);
	const hardcapEth = ether(10000);

	const ethInvestment = ether(0.001);
	const btcInvestment = new web3.BigNumber(10).pow(17);

	const ethRate = new web3.BigNumber(5250); // LEAP/ETH
	const btcRate = new web3.BigNumber(52500); // ETH/BTC

	const testingDivider = 10000;

	before(async function() {
		await utils.advanceBlock();
	});

	beforeEach(async function() {
		this.token = await Token.new();

		this.tokensale = await Tokensale.new(
			utils.latestTime() + 3600,
			this.token.address, proxy, placeholder, wallet
		);

		await this.token.transferOwnership(this.tokensale.address);
	});

	it("should be initialized correctly", async function() {
		expect(await this.tokensale.token()).to.be.equal(this.token.address);
		expect(await this.tokensale.placeholder()).to.be.equal(placeholder);
		expect(await this.tokensale.proxy()).to.be.equal(proxy);
		expect(await this.tokensale.wallet()).to.be.equal(wallet);
	});

	it("should allow owner to add members", async function() {
		await this.tokensale.addMember(investor);

		expect(await this.tokensale.isMember(investor)).to.be.true;

		await expectThrow(this.tokensale.addMember(investor));
	});

	it("should disallow non-owner to add members", async function() {
		await expectThrow(this.tokensale.addMember(investor, {from: hacker}));
	});

	it("should process payments only from members", async function() {
		await this.tokensale.addMember(investor);

		await utils.setTime(await this.tokensale.startTime());

		expect(await this.tokensale.validPayment(investor)).to.be.true;
		expect(await this.tokensale.validPayment(hacker)).to.be.false;
	});

	it("should buy coins with correct eth payments", async function() {
		await this.tokensale.addMember(investor);
		await utils.setTime(await this.tokensale.startTime());

		const expectedCoinsAmount = ethInvestment.mul(ethRate);

		const coinsAmount = (await this.tokensale.rate()).mul(ethInvestment);

		const tx = await this.tokensale.buyCoinsETH({from: investor, value: ethInvestment});
		const account = tx.logs.find(e => e.event === 'TokenPurchaseETH').args.account;

		expect(coinsAmount).to.be.bignumber.equal(expectedCoinsAmount);
		expect(await this.tokensale.leapRaised()).to.be.bignumber.equal(expectedCoinsAmount);
		expect(await this.token.balanceOf(account)).to.be.bignumber.equal(expectedCoinsAmount);
		expect(await this.tokensale.weiRaisedBy(investor)).to.be.bignumber.equal(ethInvestment);
	});

	it("should buy coins with correct btc payments", async function() {
		await this.tokensale.addMember(investor);
		await utils.setTime(await this.tokensale.startTime());

		const expectedCoinsAmount = btcInvestment.mul(btcRate);

		const coinsAmount = (await this.tokensale.btcRate()).mul(btcInvestment);

		const tx = await this.tokensale.buyCoinsBTC(investor, btcInvestment, { from: proxy });
		const account = tx.logs.find(e => e.event === 'TokenPurchaseBTC').args.account;

		expect(coinsAmount).to.be.bignumber.equal(expectedCoinsAmount);
		expect(await this.tokensale.leapRaised()).to.be.bignumber.equal(expectedCoinsAmount);
		expect(await this.token.balanceOf(account)).to.be.bignumber.equal(expectedCoinsAmount);
		expect(await this.tokensale.satoshiRaisedBy(investor)).to.be.bignumber.equal(btcInvestment);
	});

	it("should fail to overlap 52.5M coins cap", async function() {
		await this.tokensale.addMember(investor);
		await utils.setTime(await this.tokensale.startTime());

		const investment = hardcapEth.div(testingDivider);
		const expectedAmount = investment.mul(ethRate);

		await expectThrow(this.tokensale.buyCoinsETH({from: investor, value: hardcapEth.plus(ether(0.001)).div(testingDivider)}));

		await this.tokensale.buyCoinsETH({from: investor, value: investment});

		await expectThrow(this.tokensale.buyCoinsETH({from: investor, value: 1}));
		await expectThrow(this.tokensale.buyCoinsBTC(investor, 1, {from: proxy}));

		expect(await this.tokensale.leapRaised()).to.be.bignumber.equal(expectedAmount);
	});
});