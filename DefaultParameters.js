var fs = require('fs');

module.exports = function(env) {

    var settings = {
        defaultStackParams: {
            Region: 'us-west-2',
            ConfigurationManager: {
                Name: 'Chef',
                Version: '11.10'
            },
            DefaultRootDeviceType: 'ebs',
            DefaultOs: 'Amazon Linux 2017.09',
            UseCustomCookbooks: true,
            CustomCookbooksSource: {
                Type: 'git',
                Url: 'https://github.com/ykhati/ChefRepo.git'
            },
            UseOpsworksSecurityGroups: true
        },

        /* Layer Default Settings */
        defaultLayerParams: {
            Type: 'java-app',
            CustomRecipes: {
                Setup: [ 'java::deploy' ]
            },
            AutoAssignElasticIps: false,
            AutoAssignPublicIps: false,
            EnableAutoHealing: true,
            InstallUpdatesOnBoot: true,
            UseEbsOptimizedInstances: false
        },

        /* Default Instance Settings */
        defaultInstanceParams: {
            Architecture: 'x86_64'
        }
    };

    switch (env) {
        case 'qa':
            settings.defaultStackParams.DefaultInstanceProfileArn = 'arn:aws:iam::149324216444:instance-profile/aws-opsworks-ec2-role';
            settings.defaultStackParams.ServiceRoleArn = 'arn:aws:iam::149324216444:role/aws-opsworks-service-role';
            settings.defaultStackParams.DefaultSubnetId = 'subnet-b4e190cd';
            settings.defaultStackParams.VpcId = 'vpc-147f666d';
            settings.defaultLayerParams.CustomSecurityGroupIds = ['sg-01ff4e71','sg-68f64718'];
            break;
    }

    return settings;
};
