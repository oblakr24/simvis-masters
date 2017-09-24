/**
 * Created by rokoblak on 6/18/17.
 */

app.directive("viewer", function () {
    return {

        restrict: 'A',
        link: function (scope, canvasObj, attrs) {

            // Element dimensions
            let canvas = canvasObj[0];

            scope.width = canvas.offsetWidth;
            scope.height = canvas.offsetHeight;

            // call the RenderingController's init function and pass the canvas element
            scope.init(canvas);

            // Canvas resizing
            window.onresize = function(){
                // Lookup the size the browser is displaying the canvas.
                let displayWidth  = canvas.clientWidth;
                let displayHeight = canvas.clientHeight;

                // Check if the canvas is not the same size.
                if (canvas.width !== displayWidth || canvas.height !== displayHeight) {

                    // Make the canvas the same size
                    canvas.width  = displayWidth;
                    canvas.height = displayHeight;

                    // Notify controller
                    scope.resizeCanvas(displayWidth, displayHeight);
                }
            };

            window.onresize();
        }
        // , template: "<canvas width='1280px' height='720px'></canvas>"

    };
});