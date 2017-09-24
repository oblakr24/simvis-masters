/**
 * Created by rokoblak on 8/21/17.
 */

app.directive("resultsModal", function () {
    return {
        restrict: 'E',
        replace: true,
        scope: false,
        link: function (scope, modal, attributes) {

            // Make modal draggable
            modal.draggable({
                handle: ".modal-header"
            });

            scope.listExistingResults();

            // DOM references
            let resultsModal = modal;
            let loadResultsButton = resultsModal.find("#loadResultsButton");
            let tooltipWrapper = loadResultsButton.closest(".tooltip-wrapper");

            // Enable tooltip
            resultsModal.find('[data-toggle="tooltip"]').tooltip();
            resultsModal.find('[data-toggle="popover"]').popover();

            // // Toggles load button and its tooltip
            let toggleLoadButton = function(state) {
                loadResultsButton.prop('disabled', !state);
                tooltipWrapper.tooltip(state ? 'disable' : 'enable');
            };

            scope.$watch('selectedResults', function(newValue, oldValue) {
                toggleLoadButton(newValue !== null);
            });

            loadResultsButton.click(function() {
                scope.loadResults();
                modal.modal('hide');
            });
        },
        templateUrl: "app/components/html/resultsModal.html"
    }
});