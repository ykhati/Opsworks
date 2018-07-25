

cd files
chmod 755 yogesh-west2-keypair.pem
cp /Users/ykhati/Desktop/Gigya/Test/OldTemplates/yogesh-west2-keypair.pem yogesh-west2-keypair.pem
npm install
node GigyaStack.js gigya-qa qa

sudo mv set_parameters.env /params/gigya.properties
