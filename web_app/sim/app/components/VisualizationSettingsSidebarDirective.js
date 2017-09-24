/**
 * Created by rokoblak on 7/20/17.
 */


app.directive("visualizationSettings", function () {
    return {
        restrict: 'E',
        replace: true,
        scope: false,
        link: function (scope, element, attributes) {
            // Fetch the id used for sidebar content toggling
            element.attr("id", attributes.toggleId);
        },
        templateUrl: function(element, attributes) {
            return 'app/components/html/visualizationSettingsSidebar.html';
        }
    }
});