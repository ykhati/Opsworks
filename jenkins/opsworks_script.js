export AWS_ACCESS_KEY_ID=AKIAJYMKYWMM5RFF76KQ
export AWS_SECRET_ACCESS_KEY=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
export AWS_DEFAULT_REGION=us-west-2

cd files
cp /Users/ykhati/Desktop/Gigya/Test/OldTemplates/yogesh-west2-keypair.pem yogesh-west2-keypair.pem
chmod 755 yogesh-west2-keypair.pem
npm install
node GigyaStack.js gigya-qa qa

sudo mv set_parameters.env /params/gigya.properties
