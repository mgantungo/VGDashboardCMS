#Run this to fix paths 



grep -rl "_sfa-helpers" /var/www/VGDashboardCMS/src/api --include="*.js" | while read f; do
  sed -i "s|require('../../../_sfa-helpers/sfa-profile')|require('../../_sfa-helpers/sfa-profile')|g" "$f"
  sed -i "s|require('../../../../_sfa-helpers/sfa-profile')|require('../../_sfa-helpers/sfa-profile')|g" "$f"
  sed -i "s|require('../_sfa-helpers/sfa-profile')|require('../../_sfa-helpers/sfa-profile')|g" "$f"
  echo "Fixed: $f"
done
