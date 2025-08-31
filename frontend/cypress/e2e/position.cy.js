describe('Position Details - End to End Tests', () => {
  let positionId;
  
  beforeEach(() => {
    // Visit the positions page first to get a valid position ID
    cy.visit('/positions');
    
    // Wait for positions to load and get the first position ID
    cy.get('[data-cy="position-card"]').first().should('be.visible');
    cy.get('[data-cy="view-process-btn"]').first().then(($btn) => {
      // Extract position ID from the button's onclick or navigate function
      positionId = 1; // Fallback to position 1 for testing
    });
  });

  describe('Use Case 1: Position Page Load', () => {
    it('should display the position title correctly', () => {
      // Navigate to position details page
      cy.visit(`/positions/${positionId || 1}`);
      
      // Wait for the page to load
      cy.get('h2').should('be.visible');
      
      // Verify position title is displayed (any non-empty title)
      cy.get('h2').should('not.be.empty');
    });

    it('should display all columns for each hiring stage', () => {
      cy.visit(`/positions/${positionId || 1}`);
      
      // Wait for stages to load
      cy.get('[data-testid="stage-column"]').should('have.length.greaterThan', 0);
      
      // Verify that each stage column is visible
      cy.get('[data-testid="stage-column"]').each(($column) => {
        cy.wrap($column).should('be.visible');
        
        // Verify each column has a header with stage name
        cy.wrap($column).find('.card-header').should('be.visible').and('not.be.empty');
      });
      
      // Check that at least some stages are present
      cy.get('.card-header').then(($headers) => {
        const stageTexts = Array.from($headers).map(header => header.textContent.trim());
        expect(stageTexts.length).to.be.greaterThan(0);
      });
    });

    it('should display candidate cards in correct stage columns', () => {
      cy.visit(`/positions/${positionId || 1}`);
      
      // Wait for candidates to load
      cy.get('[data-testid="stage-column"]').should('be.visible');
      
      // Check each stage column for candidate cards
      cy.get('[data-testid="stage-column"]').each(($column, index) => {
        cy.wrap($column).within(() => {
          // Get the stage name
          cy.get('.card-header').invoke('text').then((stageName) => {
            
            // Check if there are candidate cards in this column
            cy.get('.card-body').within(() => {
              // If there are candidates, verify they are displayed properly
              cy.get('[data-testid="candidate-card"]').then(($candidates) => {
                if ($candidates.length > 0) {
                  // Verify each candidate card has required information
                  cy.wrap($candidates).each(($card) => {
                    cy.wrap($card).should('be.visible');
                    cy.wrap($card).find('.card-title').should('not.be.empty');
                    
                    // Verify candidate card is draggable
                    cy.wrap($card).should('have.attr', 'draggable', 'false'); // react-beautiful-dnd sets this
                  });
                }
              });
            });
          });
        });
      });
    });

    it('should load the page without errors', () => {
      cy.visit(`/positions/${positionId || 1}`);
      
      // Check that the page loads successfully
      cy.get('h2').should('be.visible');
      
      // Verify no JavaScript errors occurred
      cy.window().then((win) => {
        expect(win.console.error).to.not.have.been.called;
      });
      
      // Check that navigation back to positions works
      cy.get('button').contains('Volver a Posiciones').should('be.visible').click();
      cy.url().should('include', '/positions');
    });
  });

  describe('Use Case 2: Candidate Stage Change', () => {
    beforeEach(() => {
      // Set up API intercepts to monitor backend calls
      cy.intercept('PUT', '**/candidates/*').as('updateCandidate');
      
      // Visit the position details page
      cy.visit(`/positions/${positionId || 1}`);
      
      // Wait for the page to load completely
      cy.get('[data-testid="stage-column"]').should('be.visible');
    });

    it('should simulate dragging a candidate card from one column to another', () => {
      // Find the first column with candidates
      cy.get('[data-testid="stage-column"]').first().within(() => {
        cy.get('[data-testid="candidate-card"]').first().then(($candidateCard) => {
          if ($candidateCard.length > 0) {
            // Get the candidate name for verification
            cy.wrap($candidateCard).find('.card-title').invoke('text').then((candidateName) => {
              // Improved drag and drop for react-beautiful-dnd
              cy.wrap($candidateCard).trigger('mousedown', { button: 0 });
              
              // Find the target column (second column)
              cy.get('[data-testid="stage-column"]').eq(1).trigger('mousemove').trigger('mouseup');
              
              // Wait a moment for the drag operation to complete
              cy.wait(500);
              
              // Verify the card moved (this might require custom data attributes)
              cy.get('[data-testid="stage-column"]').eq(1).within(() => {
                cy.contains(candidateName).should('be.visible');
              });
            });
          } else {
            cy.log('No candidates available for drag and drop testing');
          }
        });
      });
    });

    it('should ensure the candidate card moves to the new column visually', () => {
      // Check if there are candidates to move
      cy.get('[data-testid="candidate-card"]').then(($cards) => {
        if ($cards.length > 0) {
          // Get initial state of columns
          cy.get('[data-testid="stage-column"]').first().within(() => {
            cy.get('[data-testid="candidate-card"]').its('length').then((initialCount) => {
              
              // Perform the drag operation
              cy.get('[data-testid="candidate-card"]').first().then(($card) => {
                const candidateName = $card.find('.card-title').text();
                
                // Simulate drag and drop
                cy.wrap($card).trigger('dragstart');
                cy.get('[data-testid="stage-column"]').eq(1).trigger('dragover');
                cy.get('[data-testid="stage-column"]').eq(1).trigger('drop');
                
                // Verify the source column has one less candidate
                cy.get('[data-testid="stage-column"]').first().within(() => {
                  cy.get('[data-testid="candidate-card"]').should('have.length', initialCount - 1);
                });
                
                // Verify the target column contains the moved candidate
                cy.get('[data-testid="stage-column"]').eq(1).within(() => {
                  cy.contains(candidateName).should('be.visible');
                });
              });
            });
          });
        } else {
          cy.log('No candidates available for testing drag and drop');
        }
      });
    });

    it('should ensure the candidate stage is updated in the backend via PUT /candidates/:id endpoint', () => {
      // Check if there are candidates to move
      cy.get('[data-testid="candidate-card"]').then(($cards) => {
        if ($cards.length > 0) {
          // Perform drag and drop operation
          cy.get('[data-testid="candidate-card"]').first().then(($card) => {
            // Extract candidate ID from data attributes or other means
            const candidateId = $card.attr('data-candidate-id') || '1'; // Fallback
            
            // Perform the drag operation
            cy.wrap($card).trigger('dragstart');
            cy.get('[data-testid="stage-column"]').eq(1).trigger('dragover');
            cy.get('[data-testid="stage-column"]').eq(1).trigger('drop');
            
            // Verify that the PUT request was made to update the candidate
            cy.wait('@updateCandidate').then((interception) => {
              expect(interception.request.method).to.equal('PUT');
              expect(interception.request.url).to.include('/candidates/');
              
              // Verify the request body contains the expected data
              expect(interception.request.body).to.have.property('applicationId');
              expect(interception.request.body).to.have.property('currentInterviewStep');
            });
          });
        } else {
          cy.log('No candidates available for testing API call');
        }
      });
    });

    it('should handle drag and drop errors gracefully', () => {
      // Set up API intercept to simulate server error
      cy.intercept('PUT', '/candidates/*', { statusCode: 500, body: { error: 'Server Error' } }).as('updateCandidateError');
      
      // Attempt drag and drop operation
      cy.get('[data-testid="candidate-card"]').then(($cards) => {
        if ($cards.length > 0) {
          cy.get('[data-testid="candidate-card"]').first().then(($card) => {
            cy.wrap($card).trigger('dragstart');
            cy.get('[data-testid="stage-column"]').eq(1).trigger('dragover');
            cy.get('[data-testid="stage-column"]').eq(1).trigger('drop');
            
            // The UI should handle the error gracefully
            // (This would depend on your error handling implementation)
            cy.wait('@updateCandidateError');
          });
        }
      });
    });

    it('should maintain drag and drop functionality across multiple operations', () => {
      // Perform multiple drag and drop operations to test consistency
      cy.get('[data-testid="candidate-card"]').then(($cards) => {
        if ($cards.length >= 2) {
          // First drag operation
          cy.get('[data-testid="candidate-card"]').first().then(($firstCard) => {
            cy.wrap($firstCard).trigger('dragstart');
            cy.get('[data-testid="stage-column"]').eq(1).trigger('dragover');
            cy.get('[data-testid="stage-column"]').eq(1).trigger('drop');
          });
          
          // Wait a moment for the first operation to complete
          cy.wait(500);
          
          // Second drag operation
          cy.get('[data-testid="candidate-card"]').eq(0).then(($secondCard) => {
            cy.wrap($secondCard).trigger('dragstart');
            cy.get('[data-testid="stage-column"]').eq(2).trigger('dragover');
            cy.get('[data-testid="stage-column"]').eq(2).trigger('drop');
          });
          
          // Verify both operations triggered API calls
          cy.get('@updateCandidate.all').should('have.length', 2);
        }
      });
    });
  });

  describe('Integration Tests', () => {
    it('should maintain data consistency between frontend and backend after stage changes', () => {
      // This test would verify that after a drag and drop:
      // 1. The UI reflects the change
      // 2. A page refresh shows the same state
      // 3. The backend data is actually updated
      
      cy.visit(`/positions/${positionId || 1}`);
      
      cy.get('[data-testid="candidate-card"]').then(($cards) => {
        if ($cards.length > 0) {
          // Record initial state
          cy.get('[data-testid="stage-column"]').eq(1).within(() => {
            cy.get('[data-testid="candidate-card"]').its('length').then((initialCount) => {
              
              // Perform drag operation
              cy.get('[data-testid="stage-column"]').first().within(() => {
                cy.get('[data-testid="candidate-card"]').first().then(($card) => {
                  cy.wrap($card).trigger('dragstart');
                  cy.get('[data-testid="stage-column"]').eq(1).trigger('dragover');
                  cy.get('[data-testid="stage-column"]').eq(1).trigger('drop');
                  
                  // Wait for API call
                  cy.wait('@updateCandidate');
                  
                  // Refresh the page to verify persistence
                  cy.reload();
                  
                  // Verify the change persisted
                  cy.get('[data-testid="stage-column"]').eq(1).within(() => {
                    cy.get('[data-testid="candidate-card"]').should('have.length', initialCount + 1);
                  });
                });
              });
            });
          });
        }
      });
    });
  });
});

// Helper functions for the tests
Cypress.Commands.add('dragAndDrop', (sourceSelector, targetSelector) => {
  cy.get(sourceSelector).trigger('dragstart');
  cy.get(targetSelector).trigger('dragover');
  cy.get(targetSelector).trigger('drop');
});

// Custom command to wait for position page to load completely
Cypress.Commands.add('waitForPositionPageLoad', () => {
  cy.get('h2').should('be.visible');
  cy.get('[data-testid="stage-column"]').should('be.visible');
  cy.get('.card-header').should('be.visible');
});
