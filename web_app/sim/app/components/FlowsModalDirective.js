/**
 * Created by rokoblak on 7/26/17.
 */


app.directive("flowsModal", function () {
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
            let flowLoaderModal = modal;
            let loadFlowFileButton = flowLoaderModal.find("#flowFileOpenButton");
            let loadButtonTooltipWrapper = loadFlowFileButton.closest(".tooltip-wrapper");
            let flowFileInput = flowLoaderModal.find("#flowFileInput");

            let setFlowFileButton = flowLoaderModal.find("#setFlowFileButton");
            let setButtonTooltipWrapper = setFlowFileButton.closest(".tooltip-wrapper");
            // File input styling
            flowFileInput.filestyle({buttonName: "btn-danger", buttonText: "&nbspChoose .flow / .txt file", size: "sm"});

            // Enable tooltip
            flowLoaderModal.find('[data-toggle="tooltip"]').tooltip();
            flowLoaderModal.find('[data-toggle="popover"]').popover();

            // button/tooltip toggles
            let toggleLoadButton = function(state) {
                loadFlowFileButton.prop('disabled', !state);
                loadButtonTooltipWrapper.tooltip(state ? 'disable' : 'enable');
            };
            let toggleSetButton = function(state) {
                setFlowFileButton.prop('disabled', !state);
                setButtonTooltipWrapper.tooltip(state ? 'disable' : 'enable');
            };

            // Function used to validate and unlock load button
            let localObjValidate = function() {
                toggleLoadButton(flowFileInput.val() !== "");
            };

            // When file is selected enable "Load" button
            flowFileInput.change(localObjValidate);

            loadFlowFileButton.click(function() {
                scope.loadFlowFile(flowFileInput.prop('files')[0])
            });

            scope.$watch('selectedFlowFile', function(newValue, oldValue) {
                toggleSetButton(newValue !== null && newValue !== undefined);
            });

            scope.$watch('sharedParams.capIdx', function(newValue, oldValue) {
                // update the selected flow file
                scope.updateSelectedFlowFile();
            });

        },
        templateUrl: "app/components/html/flowFilesModal.html"
    }
});