/**
 * Created by rokoblak on 7/19/17.
 */

app.directive("simModal", function () {
    return {
        restrict: 'E',
        replace: true,
        scope: false,
        link: function (scope, modal, attributes) {

            // Make modal draggable
            modal.draggable({
                handle: ".modal-header"
            });

            // DOM references
            let simButton = modal.find("#simButton");
            let simButtonTooltipWrapper = simButton.closest(".tooltip-wrapper");

            // Enable tooltip
            modal.find('[data-toggle="tooltip"]').tooltip();
            modal.find('[data-toggle="popover"]').popover();

            // // Toggles the Simulate button and its tooltip
            let toggleSimButton = function(state) {
                simButton.prop('disabled', !state);
                simButtonTooltipWrapper.tooltip(state ? 'disable' : 'enable');
            };

            scope.$watch('hasNeededSimParams', function(newValue, oldValue) {
                toggleSimButton(newValue)
            });

            simButton.click(function() {
                scope.simulate();
                modal.modal('hide');

            });
        },
        templateUrl: "app/components/html/simModal.html"
    }
});