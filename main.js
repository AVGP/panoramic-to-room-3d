/* jshint asi:true */
/* jshint esnext:true */

function deg2rad(angle) { return (angle / 180.0) * Math.PI; }

function rotate(v, angle) {
  return {
    x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
    y: v.x * Math.sin(angle) + v.y * Math.cos(angle)
  }
}

document.querySelector("#img").addEventListener('change', function(evt) {
  if(this.files.length === 0) return

  var reader = new FileReader()
  reader.onload = function(fe) {
    var img = new Image()
    img.onload = function() {
      console.log(img.width)
      var corners = [1950, 6100, 8370, 13100] //[150, 644, 948, 1444] // for test3, our best image so far :)
      var angles = {
        alpha: getAngleFromCoordinates(corners[0], corners[1], img.width),
        beta:  getAngleFromCoordinates(corners[1], corners[2], img.width),
        gamma: getAngleFromCoordinates(corners[2], corners[3], img.width)
      }
      angles.delta = 360 - (angles.alpha + angles.beta + angles.gamma)

//      console.log(getAngleFromCoordinates(150, 948, img.width))
//      console.log(getAngleFromCoordinates(644, 1444, img.width))
      console.log(angles)

      // we assume that the first wall has length 1 and use alpha to get the semicircle of possible camera positions
      var angleRad = deg2rad(angles.alpha)
      var camArcRadius = 1 / (2 * Math.sin(angleRad))
      console.log('Radius of camera arc:', camArcRadius)

      /*
      Now I somehow need to do the rays using the other angles ???!!!
      Well, technicall I need to construct two triangles..

          A             w1               D
          +------------------------------+
          \                              \
          \   X +                        \
          \                              \
          \                              \
          +------------------------------+
          B            w2                C

      p = X->D
      q = X->C

      So we know: The position on the semicircle (X), the length of A-X and the angle "beta" in X (for triangle AXD).
      The triangle BXC is analog to that.

      Basically the algorithm is like this:
      */
      var angle = Math.PI/2, // we start with a 90° angle
          step  = Math.PI/4  // our initial correction step is 45°

      var q_x, p_x // the target length of the unknown walls, should be identical
      do {
        console.log('> Trying angle', angle)
        var c_x = Math.sin(angle) * camArcRadius, c_y = Math.cos(angle) * camArcRadius + 0.5
        console.log('c', c_x, c_y)
        // 1. put X on (r, 0.5) on the semicircle
        // 2. rotate the vector XA (-r, 0.5) around X by angle "gamma" (but negate the angle to get the clockwise ). We've got p.
        var p = rotate({x: -1 * c_x, y: c_y}, -1 * deg2rad(angles.gamma))
        // 3. calculate the intersection for p with y=1 (as we will place A.y = D.y = 1 for convenience)
        var p_m = p.y / p.x, p_b = c_y - p_m * camArcRadius // Now we get the params for the line p_y = p_m * p_x + p_b
        console.log(p, "m=", p_m, "b=", p_b, "check=", p_m * camArcRadius + p_b)
        p_x = (1 - p_b) / p_m
        console.log('p_x=', p_x)
        // 4. rotate the vector XB around X by angle "beta". We've got q.
        var q = rotate({x: -1 * c_x, y: -1 * c_y}, deg2rad(angles.beta))
        // 5. calculate the intersection for q with y=0 (as we will place B.y = C.y = 0 for convenience)
        var q_m = q.y / q.x, q_b = c_y - q_m * camArcRadius // Now we get the params for the line p_y = p_m * p_x + p_b
        console.log(p, "m=", q_m, "b=", q_b, "check=", q_m * camArcRadius + q_b)
        q_x = (1 - q_b) / q_m
        console.log('q_x=', q_x)
        // 6. The intersection tells us the length of both walls (w1, w2). Their difference is our error
        // 8. repeat until error is small enough :)

        if(Math.abs(q_x - p_x) > 0.01) {
          // 7. If w1 > w2, we move upwards on the semicircle. If w1 < w2, we move downwards on the semicircle.
          if(p_x > q_x) {
            angle -= step
          } else {
            angle += step
          }
          step /= 2
        }
      } while(Math.abs(q_x - p_x) > 0.01 && step > Math.PI/24)

      console.log('----', 'Final result:', 'Wall length: ' + p_x, 'Cam position: ' + (camArcRadius * Math.sin(angle)) + ', ' + (camArcRadius * Math.cos(angle)))

      // Cut out the different walls from the image
      var wallImgUrls = []
      var container = document.getElementById('output')
      var canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')
      canvas.height = img.height
      for(var i=1; i<4; i++) {
        canvas.width  = (corners[i] - corners[i-1])
        ctx.drawImage(img, corners[i-1], 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
        let wallImg = new Image()
        wallImg.src = canvas.toDataURL()
        wallImgUrls.push(wallImg.src)
        container.appendChild(wallImg)
      }
      var remainingWidth = img.width - corners[3]
      canvas.width = remainingWidth + corners[0]
      ctx.drawImage(img, corners[3], 0, remainingWidth, canvas.height, 0, 0, remainingWidth, canvas.height)
      ctx.drawImage(img, 0, 0, corners[0], canvas.height, remainingWidth, 0, corners[0], canvas.height)
      let wallImg = new Image()
      wallImg.src = canvas.toDataURL()
      wallImgUrls.push(wallImg.src)
      container.appendChild(wallImg)

      // Make a mesh with the four textures
      // Hurrah! :)
      //container.appendChild(this)
    }
    img.src = fe.target.result
  }
  reader.readAsDataURL(this.files[0])
});

// Calculate the angle between two known corner coordinates (x-coordinate only) in degrees
function getAngleFromCoordinates(x1, x2, imgWidth) {
  /*  Example: An image with 1000 pixel width
      1000 px = 360°
         1 px = 360/1000°
         x px = (360/1000) * x
  */
  var pxPerDegree = 360 / imgWidth
  return pxPerDegree * Math.abs(x1 - x2)
}

/*
               X
    +--------------------+
    \        gamma       \
  1 \ alpha        delta \ 1
    \        beta        \
    +--------------------+
               X
*/
