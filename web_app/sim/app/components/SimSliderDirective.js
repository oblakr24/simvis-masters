/**
 * Created by rokoblak on 7/20/17.
 */

app.directive('simSlider', function() {
    return {
        restrict: 'E',
        replace: true,
        scope: false,
        link: function (scope, element, attributes) {

        },
        templateUrl: function(element, attributes) {
            return 'app/components/html/simSlider.html';
        }
    };
});