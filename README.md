# HeadwayLab

**Created by Tabish Syed**

HeadwayLab simulates a bus line where small delays can spread and buses can bunch together. It compares a regular service plan with a simple headway-holding strategy and estimates the effect on passenger waiting time and service reliability.

## Run

Open `index.html` in a modern browser. HeadwayLab is a static project with no build step, account, API key, or external service.

## Explore

- Change road delay, passenger demand, and the target service interval.
- Adjust the maximum hold time used by the control strategy.
- Select **Run simulation** to compare the uncontrolled line with the holding strategy.
- Review average passenger wait, bunching events, on-target headways, and mean headway by stop.

## Simulation model

The demo simulates eight buses moving across twelve stops over a 120-minute period. Travel and dwell times vary deterministically so the same settings produce the same result. In the controlled run, a bus may wait at a stop for up to the selected limit when it is too close behind the previous bus.

Passenger arrivals are approximated as uniform between bus departures. The displayed wait estimate uses half of each observed headway, weighted by the configured demand rate. The model is a teaching simulation, not a transit operations optimizer.

## Scope and limits

Route layout, demand, traffic, and bus timing are synthetic examples. This project does not use live transit feeds or predict real service performance.

## License

The original project code is available under the MIT License.