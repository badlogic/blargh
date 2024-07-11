<%
    meta("../../meta.json")
    meta()
%>
<%= include("../../_partials/post-header.html") %>

<figure>
<img src="./banner.jpg">
<figcaption>Under the see</figcaption>
</figure>

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam sed lorem imperdiet, ullamcorper eros eu, mattis lacus. Aenean laoreet volutpat tellus sed faucibus. Donec in congue felis, non dictum magna. Sed at interdum tortor, scelerisque laoreet diam. Phasellus euismod arcu ex, in rhoncus metus lobortis eget. Nulla arcu felis, rutrum in viverra eu, molestie id ligula. Fusce sed interdum tellus, vel vestibulum metus. Etiam sollicitudin, mi nec pretium mattis, urna felis semper sem, sit amet tempor elit ipsum et ante. Aenean lobortis elementum massa, semper mollis tellus luctus eu. Morbi ut sapien et diam posuere vehicula quis et lorem.

## What comes around, goes around

![](./other.jpg)

Integer commodo, diam ac varius sollicitudin, nisl tellus rhoncus odio, volutpat pulvinar leo nunc quis quam. Mauris congue tincidunt lacus a mollis. Nunc fermentum suscipit lacus, vel rutrum leo sodales venenatis. Curabitur sed elementum orci. Vivamus vitae ante sed urna malesuada tristique ut ac velit. Morbi vel urna sagittis, commodo urna eget, ultricies diam. Quisque convallis diam velit, nec scelerisque ex hendrerit et. Praesent fringilla, ligula at convallis vulputate, neque augue commodo est, eu finibus lacus est id tortor. Etiam nec malesuada justo. Quisque cursus hendrerit enim lacinia mollis. Nulla facilisi. Duis hendrerit erat est. Nulla facilisi. Aliquam sed lacinia sem. Aliquam non urna a ex posuere congue.

```c
float Q_rsqrt(float number)
{
  long i;
  float x2, y;
  const float threehalfs = 1.5F;

  x2 = number * 0.5F;
  y  = number;
  // evil floating point bit level hacking
  i  = * ( long * ) &y;
  // what the fuck?
  i  = 0x5f3759df - ( i >> 1 );
  y  = * ( float * ) &i;
  // 1st iteration
  y  = y * ( threehalfs - ( x2 * y * y ) );
  // 2nd iteration, this can be removed
  // y  = y * ( threehalfs - ( x2 * y * y ) );

  return y;
}
```

Pellentesque ullamcorper ullamcorper lorem non suscipit. Phasellus at luctus leo. Integer non consectetur dolor. Fusce id magna porttitor, commodo metus sed, blandit purus. Vivamus bibendum dictum tortor, quis condimentum odio maximus vitae. Mauris lobortis, quam eu blandit imperdiet, nisi sapien tincidunt ipsum, et placerat quam felis non nulla. Mauris in magna non enim rhoncus scelerisque. In auctor quam id libero pretium, vel dapibus ante congue. Nulla augue lorem, vehicula sed leo eu, consequat pulvinar massa. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.

## Are you sure?

Etiam pulvinar leo sed libero volutpat, a molestie purus pharetra. Etiam nec tempus mi, eget ornare nulla. Suspendisse at faucibus dui. Aliquam erat volutpat. Vestibulum sit amet libero iaculis, condimentum justo id, vestibulum enim. Nullam lacus nisi, sagittis a pellentesque et, interdum id urna. Suspendisse lobortis finibus leo in fringilla. Vestibulum condimentum purus sapien, ac cursus nunc posuere vel. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Nunc eu ex a elit malesuada venenatis. Integer orci ante, sagittis sit amet felis interdum, maximus dictum lacus. In vel auctor tortor. Nullam rhoncus viverra nibh, at congue diam pretium et. Donec egestas tortor non purus varius ornare. Pellentesque ac lorem efficitur, rutrum mi a, bibendum nunc.

Nam interdum neque vitae consequat congue. Morbi ornare justo at tincidunt sagittis. Pellentesque efficitur rhoncus erat at tristique. Praesent elementum hendrerit velit ac faucibus. Nulla in vehicula sapien, lobortis imperdiet lacus. Pellentesque scelerisque nunc sit amet mauris volutpat fermentum. Aliquam sed sem consequat, fringilla nulla at, ultricies dolor. Cras vitae diam lobortis nisl laoreet luctus. Aenean nulla quam, scelerisque vel massa vel, blandit volutpat lectus. Pellentesque purus magna, sagittis ultricies suscipit sed, viverra at orci.

<%= include("../../_partials/footer.html") %>